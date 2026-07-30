"""Synchronisation Strava → Postgres (+ météo P2)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Activity, StravaToken
from app.services.cadence import cadence_source_stats, resolve_cadence_ppm
from app.services.strava_client import StravaClient, StravaError
from app.services.terrains import activity_infer as infer_terrain
from app.services.weather import WeatherError, fetch_weather_for_activity

logger = logging.getLogger("sync.strava")
weather_logger = logging.getLogger("weather")

RUN_TYPES = {"Run", "TrailRun", "VirtualRun"}


def get_token(db: Session) -> StravaToken | None:
    return db.scalar(select(StravaToken).order_by(StravaToken.id.asc()).limit(1))


def ensure_fresh_token(db: Session, settings: Settings, token: StravaToken) -> StravaToken:
    if token.expires_at > int(time.time()) + 300:
        return token

    logger.info("Refresh token Strava | athlete_id=%s", token.athlete_id)
    client = StravaClient(settings)
    try:
        payload = client.refresh_token(token.refresh_token)
    except StravaError:
        logger.error(
            "Échec refresh token | athlete_id=%s | action=reconnect_oauth_ui",
            token.athlete_id,
        )
        raise

    token.access_token = payload["access_token"]
    token.refresh_token = payload.get("refresh_token", token.refresh_token)
    token.expires_at = int(payload["expires_at"])
    db.add(token)
    db.commit()
    db.refresh(token)
    logger.info(
        "Token Strava rafraîchi | athlete_id=%s | expires_at=%s",
        token.athlete_id,
        token.expires_at,
    )
    return token


def upsert_token_from_oauth(db: Session, payload: dict[str, Any], scope: str | None) -> StravaToken:
    athlete = payload.get("athlete") or {}
    athlete_id = int(athlete["id"])
    existing = db.scalar(select(StravaToken).where(StravaToken.athlete_id == athlete_id))
    if existing is None:
        existing = StravaToken(athlete_id=athlete_id)
    existing.access_token = payload["access_token"]
    existing.refresh_token = payload["refresh_token"]
    existing.expires_at = int(payload["expires_at"])
    existing.athlete_firstname = athlete.get("firstname")
    existing.athlete_lastname = athlete.get("lastname")
    existing.scope = scope
    db.add(existing)
    db.commit()
    db.refresh(existing)
    logger.info(
        "Compte Strava connecté | athlete_id=%s | name=%s %s",
        existing.athlete_id,
        existing.athlete_firstname,
        existing.athlete_lastname,
    )
    return existing


def _parse_start_date(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _is_run(activity: dict[str, Any]) -> bool:
    sport = activity.get("sport_type") or activity.get("type") or ""
    return sport in RUN_TYPES or activity.get("type") == "Run"


def activity_from_strava(
    raw: dict[str, Any],
    *,
    streams: dict[str, Any] | None,
) -> dict[str, Any]:
    start = raw.get("start_latlng") or [None, None]
    cadence_ppm = resolve_cadence_ppm(raw, streams, strava_id=raw.get("id"))
    return {
        "strava_id": int(raw["id"]),
        "athlete_id": int(raw["athlete"]["id"])
        if isinstance(raw.get("athlete"), dict)
        else int(raw.get("athlete", 0) or 0),
        "source": "strava",
        "name": raw.get("name") or f"Activité {raw.get('id')}",
        "sport_type": raw.get("sport_type") or raw.get("type"),
        "activity_type": raw.get("type"),
        "start_date": _parse_start_date(raw.get("start_date")),
        "timezone": raw.get("timezone"),
        "distance_m": raw.get("distance"),
        "moving_time_s": raw.get("moving_time"),
        "elapsed_time_s": raw.get("elapsed_time"),
        "total_elevation_gain_m": raw.get("total_elevation_gain"),
        "average_speed_mps": raw.get("average_speed"),
        "max_speed_mps": raw.get("max_speed"),
        "average_heartrate": raw.get("average_heartrate"),
        "max_heartrate": raw.get("max_heartrate"),
        "cadence_ppm": cadence_ppm,
        "average_watts": raw.get("average_watts"),
        "kilojoules": raw.get("kilojoules"),
        "calories": raw.get("calories"),
        "start_lat": start[0] if len(start) > 0 else None,
        "start_lng": start[1] if len(start) > 1 else None,
        "summary_polyline": (raw.get("map") or {}).get("summary_polyline"),
        "device_name": raw.get("device_name"),
        "trainer": raw.get("trainer"),
        "streams_json": streams,
        "raw_json": raw,
        "synced_at": datetime.now(timezone.utc),
    }


def recompute_cadence_from_local(db: Session) -> dict[str, int]:
    """Recalcule cadence_ppm depuis raw_json / streams_json déjà en base (sans Strava)."""
    updated = unchanged = still_missing = 0
    with_streams = with_cadence_stream = with_average = with_laps = 0
    for activity in db.scalars(select(Activity)).all():
        raw = activity.raw_json if isinstance(activity.raw_json, dict) else None
        streams = activity.streams_json if isinstance(activity.streams_json, dict) else None
        stats = cadence_source_stats(raw, streams)
        if stats["has_streams"]:
            with_streams += 1
        if stats["has_cadence_stream"]:
            with_cadence_stream += 1
        if stats["has_average_cadence"]:
            with_average += 1
        if stats["has_laps_cadence"]:
            with_laps += 1

        ppm = resolve_cadence_ppm(raw, streams, strava_id=activity.strava_id)
        if ppm is None:
            if activity.cadence_ppm is not None:
                # conserver une cadence saisie manuellement si aucune source Strava
                unchanged += 1
            else:
                still_missing += 1
            continue
        if activity.cadence_ppm != ppm:
            activity.cadence_ppm = ppm
            updated += 1
        else:
            unchanged += 1
    db.commit()
    logger.info(
        "Recalcul cadence local | updated=%s | unchanged=%s | still_missing=%s | "
        "with_streams=%s | with_cadence_stream=%s | with_average=%s | with_laps=%s",
        updated,
        unchanged,
        still_missing,
        with_streams,
        with_cadence_stream,
        with_average,
        with_laps,
    )
    return {
        "updated": updated,
        "unchanged": unchanged,
        "still_missing": still_missing,
        "with_streams": with_streams,
        "with_cadence_stream": with_cadence_stream,
        "with_average_cadence": with_average,
        "with_laps_cadence": with_laps,
    }


def refresh_cadence_from_strava(
    db: Session,
    settings: Settings,
    *,
    max_activities: int = 25,
) -> dict[str, int]:
    """Re-télécharge détail + streams Strava pour les sorties sans cadence."""
    token = get_token(db)
    if token is None:
        raise StravaError("Aucun compte Strava connecté | action=connecter_strava_ui")

    token = ensure_fresh_token(db, settings, token)
    client = StravaClient(settings)

    candidates = list(
        db.scalars(
            select(Activity)
            .where(Activity.cadence_ppm.is_(None))
            .order_by(Activity.start_date.desc().nullslast())
        ).all()
    )
    fetched = updated = still_missing = errors = 0
    for activity in candidates:
        if fetched >= max_activities:
            break
        fetched += 1
        try:
            detailed = client.get_activity(token.access_token, int(activity.strava_id))
            try:
                streams = client.get_streams(token.access_token, int(activity.strava_id))
            except StravaError as exc:
                logger.warning(
                    "Streams indisponibles (refresh cadence) | strava_id=%s | detail=%s",
                    activity.strava_id,
                    str(exc),
                )
                streams = activity.streams_json if isinstance(activity.streams_json, dict) else None

            # conserver météo + type de séance + terrain manuels
            previous_weather = activity.weather_json
            previous_session_type = activity.session_type
            previous_terrain = activity.terrain
            if not isinstance(detailed.get("athlete"), dict):
                detailed["athlete"] = {"id": activity.athlete_id}

            payload = activity_from_strava(detailed, streams=streams)
            for key, value in payload.items():
                setattr(activity, key, value)
            activity.weather_json = previous_weather
            activity.session_type = previous_session_type
            activity.terrain = previous_terrain

            if activity.cadence_ppm is not None:
                updated += 1
            else:
                still_missing += 1
        except StravaError as exc:
            errors += 1
            logger.warning(
                "Refresh cadence échoué | strava_id=%s | detail=%s",
                activity.strava_id,
                str(exc),
            )

    db.commit()
    remaining = max(0, len(candidates) - fetched)
    logger.info(
        "Refresh cadence Strava | fetched=%s | updated=%s | still_missing=%s | "
        "errors=%s | remaining=%s",
        fetched,
        updated,
        still_missing,
        errors,
        remaining,
    )
    return {
        "fetched": fetched,
        "updated": updated,
        "still_missing": still_missing,
        "errors": errors,
        "remaining": remaining,
    }


def enrich_activity_weather(activity: Activity, *, sync_id: str) -> bool:
    """Retourne True si météo écrite."""
    if activity.weather_json:
        return False
    if activity.start_lat is None or activity.start_lng is None or activity.start_date is None:
        weather_logger.info(
            "Météo ignorée | sync_id=%s | activity_id=%s | reason=pas_de_gps_ou_date",
            sync_id,
            activity.id,
        )
        return False
    if activity.trainer:
        weather_logger.info(
            "Météo ignorée | sync_id=%s | activity_id=%s | reason=séance_indoor",
            sync_id,
            activity.id,
        )
        return False

    try:
        weather = fetch_weather_for_activity(
            lat=float(activity.start_lat),
            lon=float(activity.start_lng),
            start_date=activity.start_date,
        )
    except WeatherError as exc:
        weather_logger.warning(
            "Échec météo | sync_id=%s | activity_id=%s | detail=%s",
            sync_id,
            activity.id,
            str(exc),
        )
        return False

    activity.weather_json = weather
    weather_logger.info(
        "Enrichissement OK | sync_id=%s | activity_id=%s | temp_c=%s | precip_mm=%s | label=%s",
        sync_id,
        activity.id,
        weather.get("temperature_c"),
        weather.get("precipitation_mm"),
        weather.get("weather_label_fr"),
    )
    return True


def sync_activities(db: Session, settings: Settings, *, max_pages: int = 5) -> dict[str, int | str]:
    token = get_token(db)
    if token is None:
        raise StravaError("Aucun compte Strava connecté | action=connecter_strava_ui")

    sync_id = f"sync-{int(time.time())}"
    logger.info(
        "Sync démarré | sync_id=%s | athlete_id=%s | mode=incremental",
        sync_id,
        token.athlete_id,
    )
    token = ensure_fresh_token(db, settings, token)
    client = StravaClient(settings)

    latest = db.scalar(select(Activity).order_by(Activity.start_date.desc()).limit(1))
    after_ts = int(latest.start_date.timestamp()) if latest and latest.start_date else None

    created = updated = skipped = fetched = weather_enriched = 0
    page = 1
    while page <= max_pages:
        batch = client.list_activities(
            token.access_token,
            after=after_ts,
            page=page,
            per_page=50,
        )
        if not batch:
            break
        fetched += len(batch)
        for item in batch:
            if not _is_run(item):
                skipped += 1
                continue

            strava_id = int(item["id"])
            detailed = client.get_activity(token.access_token, strava_id)
            if not isinstance(detailed.get("athlete"), dict):
                detailed["athlete"] = {"id": token.athlete_id}

            streams: dict[str, Any] | None
            try:
                streams = client.get_streams(token.access_token, strava_id)
            except StravaError as exc:
                logger.warning(
                    "Streams indisponibles | strava_id=%s | detail=%s",
                    strava_id,
                    str(exc),
                )
                streams = None

            payload = activity_from_strava(detailed, streams=streams)
            if payload["athlete_id"] == 0:
                payload["athlete_id"] = token.athlete_id

            existing = db.scalar(select(Activity).where(Activity.strava_id == strava_id))
            if existing is None:
                row = Activity(**payload)
                guessed = infer_terrain(row)
                if guessed:
                    row.terrain = guessed
                db.add(row)
                db.flush()
                created += 1
                logger.info(
                    "Activité importée | sync_id=%s | strava_id=%s | distance_m=%s | cadence_ppm=%s | terrain=%s",
                    sync_id,
                    strava_id,
                    payload["distance_m"],
                    payload["cadence_ppm"],
                    row.terrain,
                )
            else:
                # Ne pas écraser météo, type de séance, terrain, ni lien Apple
                previous_weather = existing.weather_json
                previous_session_type = existing.session_type
                previous_terrain = existing.terrain
                previous_apple_uuid = existing.apple_uuid
                for key, value in payload.items():
                    setattr(existing, key, value)
                existing.weather_json = previous_weather
                existing.session_type = previous_session_type
                existing.terrain = previous_terrain
                existing.apple_uuid = previous_apple_uuid
                if previous_terrain is None:
                    guessed = infer_terrain(existing)
                    if guessed:
                        existing.terrain = guessed
                if previous_apple_uuid:
                    existing.source = "strava"  # source sync reste strava ; lien via apple_uuid
                updated += 1
                logger.info(
                    "Activité mise à jour | sync_id=%s | strava_id=%s | cadence_ppm=%s",
                    sync_id,
                    strava_id,
                    payload["cadence_ppm"],
                )
        db.commit()
        if len(batch) < 50:
            break
        page += 1

    # Enrichissement météo : max 15 / Sync pour éviter timeout HTTP
    weather_budget = 15
    for activity in db.scalars(select(Activity).where(Activity.weather_json.is_(None))).all():
        if weather_enriched >= weather_budget:
            weather_logger.info(
                "Budget météo Sync atteint | sync_id=%s | enriched=%s | restera_au_prochain_sync=oui",
                sync_id,
                weather_enriched,
            )
            break
        if enrich_activity_weather(activity, sync_id=sync_id):
            weather_enriched += 1
    db.commit()

    remaining_weather = db.scalar(
        select(Activity).where(Activity.weather_json.is_(None)).limit(1)
    )
    more = " (relancer Sync pour continuer la météo)" if remaining_weather else ""

    cadence_stats = recompute_cadence_from_local(db)

    from app.services import activity_features as features_service

    features_stats = features_service.recompute_features_batch(db, force=False)

    message = (
        f"Sync terminée : {created} créée(s), {updated} mise(s) à jour, "
        f"{skipped} ignorée(s), météo enrichie {weather_enriched}, "
        f"cadence recalculée {cadence_stats['updated']}, "
        f"features {features_stats['updated']}.{more}"
    )
    logger.info(
        "Sync terminé | sync_id=%s | created=%s | updated=%s | skipped=%s | fetched=%s | weather=%s",
        sync_id,
        created,
        updated,
        skipped,
        fetched,
        weather_enriched,
    )
    try:
        from app.services import coach_jobs

        hooks = coach_jobs.after_sync_hooks(created=created)
        if hooks.get("plan") or hooks.get("analyses"):
            message += " Coach : plan/analyses planifiés en arrière-plan."
    except Exception:
        logger.exception("Hooks coach post-sync échoués | sync_id=%s", sync_id)

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_fetched": fetched,
        "weather_enriched": weather_enriched,
        "message": message,
    }


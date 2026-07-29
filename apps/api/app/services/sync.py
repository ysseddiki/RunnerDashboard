"""Synchronisation Strava → Postgres."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Activity, StravaToken
from app.services.strava_client import StravaClient, StravaError

logger = logging.getLogger("sync.strava")

RUN_TYPES = {"Run", "TrailRun", "VirtualRun"}


def get_token(db: Session) -> StravaToken | None:
    return db.scalar(select(StravaToken).order_by(StravaToken.id.asc()).limit(1))


def ensure_fresh_token(db: Session, settings: Settings, token: StravaToken) -> StravaToken:
    # Refresh 5 minutes before expiry
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
    logger.info("Token Strava rafraîchi | athlete_id=%s | expires_at=%s", token.athlete_id, token.expires_at)
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
    cadence = raw.get("average_cadence")
    if cadence is None:
        logger.info(
            "Cadence PPM absente | strava_id=%s | reason=absent_chez_strava",
            raw.get("id"),
        )
    return {
        "strava_id": int(raw["id"]),
        "athlete_id": int(raw["athlete"]["id"]) if isinstance(raw.get("athlete"), dict) else int(raw.get("athlete", 0) or 0),
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
        "cadence_ppm": float(cadence) if cadence is not None else None,
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

    created = updated = skipped = fetched = 0
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
            # athlete id may be missing shape on list endpoint
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
                db.add(row)
                created += 1
                logger.info(
                    "Activité importée | sync_id=%s | strava_id=%s | distance_m=%s | cadence_ppm=%s",
                    sync_id,
                    strava_id,
                    payload["distance_m"],
                    payload["cadence_ppm"],
                )
            else:
                for key, value in payload.items():
                    setattr(existing, key, value)
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

    message = (
        f"Sync terminée : {created} créée(s), {updated} mise(s) à jour, "
        f"{skipped} ignorée(s) (non-running)."
    )
    logger.info(
        "Sync terminé | sync_id=%s | created=%s | updated=%s | skipped=%s | fetched=%s",
        sync_id,
        created,
        updated,
        skipped,
        fetched,
    )
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_fetched": fetched,
        "message": message,
    }

"""Orchestration import / lien Apple Santé."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, AppleWorkout, StravaToken
from app.services.apple_health_parse import AppleHealthParseError, parse_workouts_from_zip
from app.services.apple_match import find_candidates

logger = logging.getLogger("apple_health")

# Borne la taille de la réponse d'import (les compteurs restent exhaustifs).
MAX_IMPORT_ITEMS = 200

WORKOUT_LABELS = {
    "HKWorkoutActivityTypeRunning": "Course",
    "HKWorkoutActivityTypeWalking": "Marche",
    "HKWorkoutActivityTypeHiking": "Randonnée",
    "HKWorkoutActivityTypeTrailRunning": "Trail",
}


def workout_to_dict(w: AppleWorkout) -> dict[str, Any]:
    return {
        "id": w.id,
        "apple_uuid": w.apple_uuid,
        "workout_type": w.workout_type,
        "workout_type_label_fr": WORKOUT_LABELS.get(w.workout_type or "", w.workout_type),
        "start_date": w.start_date.isoformat() if w.start_date else None,
        "end_date": w.end_date.isoformat() if w.end_date else None,
        "duration_s": w.duration_s,
        "distance_m": w.distance_m,
        "avg_hr": w.avg_hr,
        "max_hr": w.max_hr,
        "energy_kcal": w.energy_kcal,
        "cadence_ppm": w.cadence_ppm,
        "activity_id": w.activity_id,
        "imported_at": w.imported_at.isoformat() if w.imported_at else None,
    }


def enrich_activity_gaps(activity: Activity, workout: AppleWorkout) -> list[str]:
    """Remplit uniquement les trous ; ne remplace jamais une valeur existante."""
    filled: list[str] = []
    if activity.cadence_ppm is None and workout.cadence_ppm is not None:
        activity.cadence_ppm = workout.cadence_ppm
        filled.append("cadence_ppm")
    if activity.average_heartrate is None and workout.avg_hr is not None:
        activity.average_heartrate = workout.avg_hr
        filled.append("average_heartrate")
    if activity.max_heartrate is None and workout.max_hr is not None:
        activity.max_heartrate = workout.max_hr
        filled.append("max_heartrate")
    if activity.calories is None and workout.energy_kcal is not None:
        activity.calories = workout.energy_kcal
        filled.append("calories")
    if filled:
        logger.info(
            "Enrichissement trous Apple→Strava | activity_id=%s | apple_uuid=%s | fields=%s",
            activity.id,
            workout.apple_uuid,
            ",".join(filled),
        )
    else:
        logger.info(
            "Aucun trou à enrichir | activity_id=%s | apple_uuid=%s",
            activity.id,
            workout.apple_uuid,
        )
    return filled


def link_workout(
    db: Session,
    workout: AppleWorkout,
    activity: Activity,
    *,
    commit: bool = True,
) -> dict[str, Any]:
    if activity.strava_id is None and activity.source == "apple":
        raise ValueError(
            "Impossible de lier vers une activité Apple-only ; choisissez une sortie Strava"
        )
    if workout.user_id != activity.user_id:
        raise ValueError("Activité et workout Apple appartiennent à des utilisateurs différents")

    other = db.scalar(
        select(AppleWorkout).where(
            AppleWorkout.user_id == workout.user_id,
            AppleWorkout.activity_id == activity.id,
            AppleWorkout.id != workout.id,
        )
    )
    if other is not None:
        other.activity_id = None

    workout.activity_id = activity.id
    activity.apple_uuid = workout.apple_uuid
    filled = enrich_activity_gaps(activity, workout)
    if commit:
        db.commit()
        db.refresh(workout)
        db.refresh(activity)
    else:
        db.flush()
    return {
        "workout": workout_to_dict(workout),
        "activity_id": activity.id,
        "enriched_fields": filled,
    }


def unlink_workout(db: Session, workout: AppleWorkout) -> dict[str, Any]:
    activity = db.get(Activity, workout.activity_id) if workout.activity_id else None
    workout.activity_id = None
    if activity is not None and activity.apple_uuid == workout.apple_uuid:
        activity.apple_uuid = None
    db.commit()
    db.refresh(workout)
    return {"workout": workout_to_dict(workout), "unlinked": True}


def promote_to_activity(
    db: Session,
    user_id: int,
    workout: AppleWorkout,
    *,
    commit: bool = True,
) -> Activity:
    """Crée une Activity source=apple si absente."""
    existing = db.scalar(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.apple_uuid == workout.apple_uuid,
        )
    )
    if existing is not None:
        workout.activity_id = existing.id
        if commit:
            db.commit()
        else:
            db.flush()
        return existing

    if workout.activity_id:
        linked = db.get(Activity, workout.activity_id)
        if linked is not None:
            return linked

    athlete_id = 0
    token = db.scalar(select(StravaToken).where(StravaToken.user_id == user_id).limit(1))
    if token is not None:
        athlete_id = token.athlete_id

    label = WORKOUT_LABELS.get(workout.workout_type or "", "Séance")
    date_part = (
        workout.start_date.strftime("%d/%m/%Y") if workout.start_date else "sans date"
    )
    name = f"{label} Apple · {date_part}"

    duration = int(workout.duration_s) if workout.duration_s else None
    avg_speed = None
    if workout.distance_m and workout.duration_s and workout.duration_s > 0:
        avg_speed = workout.distance_m / workout.duration_s

    activity = Activity(
        user_id=user_id,
        strava_id=None,
        athlete_id=athlete_id,
        source="apple",
        apple_uuid=workout.apple_uuid,
        name=name,
        sport_type="Run" if "Running" in (workout.workout_type or "") else "Walk",
        activity_type="Run" if "Running" in (workout.workout_type or "") else "Walk",
        start_date=workout.start_date,
        distance_m=workout.distance_m,
        moving_time_s=duration,
        elapsed_time_s=duration,
        average_speed_mps=avg_speed,
        average_heartrate=workout.avg_hr,
        max_heartrate=workout.max_hr,
        cadence_ppm=workout.cadence_ppm,
        calories=workout.energy_kcal,
        device_name="Apple Santé",
        raw_json=workout.raw_json,
        synced_at=datetime.now(timezone.utc),
    )
    db.add(activity)
    db.flush()
    workout.activity_id = activity.id
    if commit:
        db.commit()
        db.refresh(activity)
    logger.info(
        "Activité Apple créée | activity_id=%s | apple_uuid=%s | distance_m=%s",
        activity.id,
        workout.apple_uuid,
        workout.distance_m,
    )
    return activity


def upsert_workout(db: Session, user_id: int, payload: dict[str, Any]) -> tuple[AppleWorkout, bool]:
    """Retourne (workout, created)."""
    existing = db.scalar(
        select(AppleWorkout).where(
            AppleWorkout.user_id == user_id,
            AppleWorkout.apple_uuid == payload["apple_uuid"],
        )
    )
    if existing is None:
        row = AppleWorkout(user_id=user_id, **payload)
        db.add(row)
        db.flush()
        return row, True

    for key in (
        "workout_type",
        "start_date",
        "end_date",
        "duration_s",
        "distance_m",
        "avg_hr",
        "max_hr",
        "energy_kcal",
        "cadence_ppm",
        "raw_json",
    ):
        setattr(existing, key, payload.get(key))
    existing.imported_at = datetime.now(timezone.utc)
    db.flush()
    return existing, False


def import_zip(
    db: Session,
    user_id: int,
    data: bytes,
    *,
    auto_link: bool = True,
    auto_promote: bool = True,
) -> dict[str, Any]:
    try:
        parsed = parse_workouts_from_zip(data)
    except AppleHealthParseError:
        raise

    imported = updated = auto_linked = promoted = 0
    items: list[dict[str, Any]] = []

    for payload in parsed:
        workout, created = upsert_workout(db, user_id, payload)
        if created:
            imported += 1
        else:
            updated += 1

        action = "none"
        candidates = find_candidates(db, user_id, workout)
        enriched: list[str] = []

        if workout.activity_id:
            action = "already_linked"
        elif auto_link and len(candidates) == 1 and candidates[0]["confidence"] == "haute":
            activity = db.get(Activity, candidates[0]["activity_id"])
            if activity is not None and activity.user_id == user_id:
                result = link_workout(db, workout, activity, commit=False)
                enriched = result["enriched_fields"]
                action = "auto_linked"
                auto_linked += 1
        elif auto_promote and not candidates:
            promote_to_activity(db, user_id, workout, commit=False)
            action = "promoted"
            promoted += 1

        items.append(
            {
                "workout": workout_to_dict(workout),
                "candidates": candidates,
                "action": action,
                "enriched_fields": enriched,
            }
        )

    db.commit()
    message = (
        f"Import Apple : {imported} nouveau(x), {updated} mis à jour, "
        f"{auto_linked} lié(s) auto, {promoted} créé(s) comme activité."
    )
    if len(items) > MAX_IMPORT_ITEMS:
        message += f" Détail limité aux {MAX_IMPORT_ITEMS} premiers éléments."
    logger.info(message)
    return {
        "imported": imported,
        "updated": updated,
        "auto_linked": auto_linked,
        "promoted": promoted,
        "total": len(items),
        "items": items[:MAX_IMPORT_ITEMS],
        "message": message,
    }


def list_workouts(
    db: Session,
    user_id: int,
    *,
    unlinked_only: bool = False,
    limit: int = 50,
) -> list[AppleWorkout]:
    stmt = (
        select(AppleWorkout)
        .where(AppleWorkout.user_id == user_id)
        .order_by(AppleWorkout.start_date.desc().nullslast())
    )
    if unlinked_only:
        stmt = stmt.where(AppleWorkout.activity_id.is_(None))
    stmt = stmt.limit(limit)
    return list(db.scalars(stmt).all())

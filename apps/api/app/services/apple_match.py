"""Matching Apple workouts ↔ activités Strava."""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, AppleWorkout

Confidence = Literal["haute", "moyenne", "basse"]

START_WINDOW_S = 10 * 60
DIST_TOLERANCE = 0.08
DURATION_TOLERANCE = 0.12
MIN_SCORE = 45


def _duration_s(activity: Activity) -> float | None:
    if activity.moving_time_s and activity.moving_time_s > 0:
        return float(activity.moving_time_s)
    if activity.elapsed_time_s and activity.elapsed_time_s > 0:
        return float(activity.elapsed_time_s)
    return None


def score_match(workout: AppleWorkout, activity: Activity) -> dict[str, Any] | None:
    if not workout.start_date or not activity.start_date:
        return None

    delta_start = abs((workout.start_date - activity.start_date).total_seconds())
    if delta_start > START_WINDOW_S:
        return None

    reasons: list[str] = []
    score = 0.0

    # Temps : jusqu'à 45 pts
    time_score = max(0.0, 45.0 * (1.0 - delta_start / START_WINDOW_S))
    score += time_score
    reasons.append(f"Δdébut {int(delta_start)} s")

    # Distance : jusqu'à 35 pts
    if workout.distance_m and activity.distance_m and max(workout.distance_m, activity.distance_m) > 0:
        rel = abs(workout.distance_m - activity.distance_m) / max(
            workout.distance_m, activity.distance_m
        )
        if rel > DIST_TOLERANCE * 2.5:
            return None
        dist_score = max(0.0, 35.0 * (1.0 - rel / (DIST_TOLERANCE * 2.5)))
        score += dist_score
        reasons.append(f"Δdistance {rel * 100:.1f} %")
    else:
        score += 10.0
        reasons.append("distance partielle")

    # Durée : jusqu'à 20 pts
    w_dur = workout.duration_s
    a_dur = _duration_s(activity)
    if w_dur and a_dur and max(w_dur, a_dur) > 0:
        rel_d = abs(w_dur - a_dur) / max(w_dur, a_dur)
        if rel_d > DURATION_TOLERANCE * 2.5:
            return None
        dur_score = max(0.0, 20.0 * (1.0 - rel_d / (DURATION_TOLERANCE * 2.5)))
        score += dur_score
        reasons.append(f"Δdurée {rel_d * 100:.1f} %")
    else:
        score += 5.0

    if score < MIN_SCORE:
        return None

    if score >= 85 and delta_start <= 180:
        confidence: Confidence = "haute"
    elif score >= 65:
        confidence = "moyenne"
    else:
        confidence = "basse"

    return {
        "activity_id": activity.id,
        "activity_name": activity.name,
        "strava_id": activity.strava_id,
        "start_date": activity.start_date.isoformat() if activity.start_date else None,
        "distance_m": activity.distance_m,
        "score": round(score, 1),
        "confidence": confidence,
        "reasons_fr": reasons,
    }


def find_candidates(
    db: Session,
    user_id: int,
    workout: AppleWorkout,
    *,
    exclude_linked: bool = True,
    limit: int = 5,
) -> list[dict[str, Any]]:
    if not workout.start_date:
        return []

    window = timedelta(seconds=START_WINDOW_S)
    low = workout.start_date - window
    high = workout.start_date + window

    stmt = (
        select(Activity)
        .where(Activity.user_id == user_id)
        .where(Activity.start_date.is_not(None))
        .where(Activity.start_date >= low)
        .where(Activity.start_date <= high)
        .where(Activity.strava_id.is_not(None))
    )
    rows = list(db.scalars(stmt).all())

    linked_ids: set[int] = set()
    if exclude_linked:
        linked = db.scalars(
            select(AppleWorkout.activity_id).where(
                AppleWorkout.user_id == user_id,
                AppleWorkout.activity_id.is_not(None),
                AppleWorkout.id != workout.id,
            )
        ).all()
        linked_ids = {aid for aid in linked if aid is not None}
        # Aussi exclure activités déjà marquées apple_uuid différent
        for a in rows:
            if a.apple_uuid and a.apple_uuid != workout.apple_uuid:
                linked_ids.add(a.id)

    candidates: list[dict[str, Any]] = []
    for activity in rows:
        if activity.id in linked_ids:
            continue
        scored = score_match(workout, activity)
        if scored:
            candidates.append(scored)

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:limit]

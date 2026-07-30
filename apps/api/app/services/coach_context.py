"""Contexte déterministe pour le coach (prévisions + analytics + activités)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity
from app.services.analytics import build_overview
from app.services.predictions import build_predictions_overview
from app.services.session_types import label_for
from app.services.terrains import label_for as terrain_label_for


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return round(1000.0 / mps, 1)


def _fmt_pace(sec: float | None) -> str | None:
    if sec is None:
        return None
    mm = int(sec // 60)
    ss = int(round(sec % 60))
    if ss == 60:
        mm += 1
        ss = 0
    return f"{mm}:{ss:02d}/km"


def build_coach_context(db: Session, *, recent_limit: int = 12) -> dict[str, Any]:
    predictions = build_predictions_overview(db)
    analytics = build_overview(db)

    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.desc())
            .limit(recent_limit)
        ).all()
    )

    recent: list[dict[str, Any]] = []
    for a in rows:
        weather = a.weather_json if isinstance(a.weather_json, dict) else None
        pace = _pace_sec_per_km(a.average_speed_mps)
        recent.append(
            {
                "id": a.id,
                "date": a.start_date.isoformat() if a.start_date else None,
                "name": a.name,
                "session_type": a.session_type,
                "session_type_label_fr": label_for(a.session_type),
                "terrain": a.terrain,
                "terrain_label_fr": terrain_label_for(a.terrain),
                "distance_km": round((a.distance_m or 0) / 1000.0, 2),
                "pace_sec_per_km": pace,
                "pace_label": _fmt_pace(pace),
                "moving_time_min": round((a.moving_time_s or 0) / 60.0, 1)
                if a.moving_time_s
                else None,
                "avg_hr_bpm": round(a.average_heartrate, 0) if a.average_heartrate else None,
                "max_hr_bpm": round(a.max_heartrate, 0) if a.max_heartrate else None,
                "cadence_ppm": a.cadence_ppm,
                "elevation_gain_m": round(a.total_elevation_gain_m, 0)
                if a.total_elevation_gain_m is not None
                else None,
                "weather_label_fr": (weather or {}).get("weather_label_fr"),
                "temperature_c": (weather or {}).get("temperature_c"),
            }
        )

    # Compact predictions for the prompt
    pred_compact: dict[str, Any] = {
        "available": predictions.get("available"),
        "confidence": predictions.get("confidence"),
        "warnings": predictions.get("warnings") or [],
        "reasons": predictions.get("reasons") or [],
        "estimates": [
            {
                "id": e["id"],
                "label": e["label_fr"],
                "pace": _fmt_pace(e.get("pace_sec_per_km")),
                "pace_low": _fmt_pace(e.get("pace_low_sec_per_km")),
                "pace_high": _fmt_pace(e.get("pace_high_sec_per_km")),
                "finish_time_s": e.get("finish_time_s"),
            }
            for e in (predictions.get("estimates") or [])
        ],
        "training_paces": [
            {
                "type": t["session_type"],
                "label": t["label_fr"],
                "pace": _fmt_pace(t.get("pace_sec_per_km")),
                "source": t.get("source"),
            }
            for t in (predictions.get("training_paces") or [])
        ],
        "trend_10k_last": None,
        "anchor": None,
    }
    trend = predictions.get("trend_10k") or []
    if trend:
        pred_compact["trend_10k_last"] = {
            "week": trend[-1].get("week"),
            "pace": _fmt_pace(trend[-1].get("pace_sec_per_km")),
        }
        if len(trend) >= 2:
            pred_compact["trend_10k_first"] = {
                "week": trend[0].get("week"),
                "pace": _fmt_pace(trend[0].get("pace_sec_per_km")),
            }
    if predictions.get("anchor"):
        an = predictions["anchor"]
        pred_compact["anchor"] = {
            "name": an.get("name"),
            "date": an.get("start_date"),
            "distance_km": an.get("distance_km"),
            "pace": _fmt_pace(an.get("pace_sec_per_km")),
            "session_type": an.get("session_type_label_fr") or an.get("session_type"),
            "method": an.get("method"),
        }

    analytics_compact = {
        "category": analytics.get("category_label_fr") or analytics.get("category"),
        "reasons": analytics.get("reasons") or [],
        "totals": analytics.get("totals"),
        "window_28d": {
            "activities": (analytics.get("window_28d") or {}).get("activities"),
            "distance_km": (analytics.get("window_28d") or {}).get("distance_km"),
            "avg_pace": _fmt_pace((analytics.get("window_28d") or {}).get("avg_pace_sec_per_km")),
            "avg_hr": (analytics.get("window_28d") or {}).get("avg_heartrate"),
            "avg_cadence_ppm": (analytics.get("window_28d") or {}).get("avg_cadence_ppm"),
        },
        "trends": analytics.get("trends"),
        "weather": analytics.get("weather"),
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "predictions": pred_compact,
        "analytics": analytics_compact,
        "recent_activities": recent,
    }

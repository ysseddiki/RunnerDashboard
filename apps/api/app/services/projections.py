"""Projection déterministe volume / allure 10 km."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.services import analytics as analytics_service
from app.services import predictions as predictions_service


def build_projection(db: Session) -> dict[str, Any]:
    overview = analytics_service.build_overview(db)
    pred = predictions_service.build_predictions_overview(db)
    weekly = overview.get("weekly_volume") or []
    trend = pred.get("trend_10k") or []

    history_volume = [
        {"week": w["week"], "distance_km": w["distance_km"], "kind": "history"}
        for w in weekly[-12:]
    ]
    history_pace = [
        {
            "week": p["week"],
            "pace_sec_per_km": p["pace_sec_per_km"],
            "kind": "history",
        }
        for p in trend[-12:]
    ]

    vol_pct = (overview.get("trends") or {}).get("volume_pct")
    category = overview.get("category")
    last_vols = [w["distance_km"] for w in history_volume[-4:]] or [0.0]
    avg_vol = sum(last_vols) / len(last_vols)
    factor = 0.98 if category == "charge_elevee" else 1.0
    if isinstance(vol_pct, (int, float)):
        # amortir la tendance
        factor *= 1.0 + max(-0.05, min(0.05, float(vol_pct) / 100.0 / 2))

    last_paces = [p["pace_sec_per_km"] for p in history_pace[-4:]] or []
    avg_pace = sum(last_paces) / len(last_paces) if last_paces else None

    # Projeter 8 semaines
    projected_volume: list[dict[str, Any]] = []
    projected_pace: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    iso = now.isocalendar()
    year, week = iso.year, iso.week
    for i in range(1, 9):
        week += 1
        if week > 52:
            week = 1
            year += 1
        key = f"{year}-W{week:02d}"
        projected_volume.append(
            {
                "week": key,
                "distance_km": round(avg_vol * (factor**i), 2),
                "kind": "projected",
            }
        )
        if avg_pace is not None:
            # légère amélioration si progression, sinon stable
            pace_factor = 0.997 if category == "progression" else 1.0
            if category == "charge_elevee":
                pace_factor = 1.002
            projected_pace.append(
                {
                    "week": key,
                    "pace_sec_per_km": round(avg_pace * (pace_factor**i), 1),
                    "kind": "projected",
                }
            )

    return {
        "available": len(history_volume) >= 1 or len(history_pace) >= 1,
        "horizon_weeks": 8,
        "category": category,
        "volume": history_volume + projected_volume,
        "pace_10k": history_pace + projected_pace,
        "notes_fr": [
            "Projection déterministe (pas d’IA).",
            "Charge élevée → volume projeté un peu réduit.",
            "Progression → allure 10 km légèrement plus rapide sur l’horizon.",
        ],
        "generated_at": now.isoformat(),
    }

"""Analytics d'évolution running (P3)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity

MIN_ACTIVITIES = 5


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return 1000.0 / mps


def _avg(values: list[float]) -> float | None:
    return mean(values) if values else None


def _pct_change(old: float | None, new: float | None) -> float | None:
    if old is None or new is None or old == 0:
        return None
    return ((new - old) / abs(old)) * 100.0


def _week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def build_overview(db: Session) -> dict[str, Any]:
    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.asc())
        ).all()
    )

    now = datetime.now(timezone.utc)
    recent_start = now - timedelta(days=28)
    previous_start = now - timedelta(days=56)

    recent = [a for a in rows if a.start_date and a.start_date >= recent_start]
    previous = [
        a
        for a in rows
        if a.start_date and previous_start <= a.start_date < recent_start
    ]

    def volume_km(items: list[Activity]) -> float:
        return sum((a.distance_m or 0.0) for a in items) / 1000.0

    def avg_speed(items: list[Activity]) -> float | None:
        vals = [a.average_speed_mps for a in items if a.average_speed_mps and a.average_speed_mps > 0]
        return _avg(vals)  # type: ignore[arg-type]

    def avg_metric(items: list[Activity], attr: str) -> float | None:
        vals = [getattr(a, attr) for a in items if getattr(a, attr) is not None]
        return _avg(vals)  # type: ignore[arg-type]

    vol_recent = volume_km(recent)
    vol_previous = volume_km(previous)
    speed_recent = avg_speed(recent)
    speed_previous = avg_speed(previous)

    # Volumes hebdomadaires (12 dernières semaines)
    week_buckets: dict[str, float] = defaultdict(float)
    week_counts: dict[str, int] = defaultdict(int)
    cutoff = now - timedelta(weeks=12)
    for a in rows:
        if not a.start_date or a.start_date < cutoff:
            continue
        key = _week_key(a.start_date.astimezone(timezone.utc))
        week_buckets[key] += (a.distance_m or 0.0) / 1000.0
        week_counts[key] += 1
    weekly_volume = [
        {"week": week, "distance_km": round(week_buckets[week], 2), "runs": week_counts[week]}
        for week in sorted(week_buckets.keys())
    ]

    # Charge 14j vs moyenne 6 semaines avant
    last_14 = [a for a in rows if a.start_date and a.start_date >= now - timedelta(days=14)]
    before_14 = [
        a
        for a in rows
        if a.start_date
        and now - timedelta(days=56) <= a.start_date < now - timedelta(days=14)
    ]
    vol_14 = volume_km(last_14)
    # moyenne sur ~6 semaines (42j) → volume hebdo moyen * 2
    weeks_before = max((42 / 7), 1)
    avg_14_equivalent = (volume_km(before_14) / weeks_before) * 2

    category = "donnees_insuffisantes"
    reasons: list[str] = []
    if len(rows) < MIN_ACTIVITIES:
        reasons.append(f"Seulement {len(rows)} sortie(s) (minimum {MIN_ACTIVITIES}).")
    else:
        vol_change = _pct_change(vol_previous if vol_previous > 0 else None, vol_recent)
        # Allure : hausse de vitesse = progression
        speed_change = _pct_change(speed_previous, speed_recent)

        if avg_14_equivalent > 0 and vol_14 > avg_14_equivalent * 1.35:
            category = "charge_elevee"
            reasons.append(
                f"Volume 14 j ({vol_14:.1f} km) nettement au-dessus de la référence "
                f"({avg_14_equivalent:.1f} km)."
            )
        else:
            improved = False
            declined = False
            if vol_change is not None:
                if vol_change >= 5:
                    improved = True
                    reasons.append(f"Volume 28 j en hausse ({vol_change:+.0f} %).")
                elif vol_change <= -5:
                    declined = True
                    reasons.append(f"Volume 28 j en baisse ({vol_change:+.0f} %).")
            if speed_change is not None:
                if speed_change >= 3:
                    improved = True
                    reasons.append(f"Allure moyenne plus rapide ({speed_change:+.0f} % vitesse).")
                elif speed_change <= -3:
                    declined = True
                    reasons.append(f"Allure moyenne plus lente ({speed_change:+.0f} % vitesse).")

            if improved and not declined:
                category = "progression"
            elif declined and not improved:
                category = "baisse"
            else:
                category = "plateau"
                if not reasons:
                    reasons.append("Peu de variation de volume / allure sur 28 jours.")

    # Météo
    with_weather = [a for a in rows if a.weather_json]
    temps = [
        float(a.weather_json["temperature_c"])
        for a in with_weather
        if a.weather_json and a.weather_json.get("temperature_c") is not None
    ]
    rainy = [
        a
        for a in with_weather
        if a.weather_json and (a.weather_json.get("precipitation_mm") or 0) > 0
    ]
    weather_summary = {
        "activities_with_weather": len(with_weather),
        "avg_temperature_c": round(_avg(temps), 1) if temps else None,
        "rainy_runs": len(rainy),
        "rainy_share_pct": round(100 * len(rainy) / len(with_weather), 1) if with_weather else None,
    }

    labels = {
        "progression": "Progression",
        "plateau": "Plateau",
        "baisse": "Baisse",
        "charge_elevee": "Charge élevée",
        "donnees_insuffisantes": "Données insuffisantes",
    }

    return {
        "category": category,
        "category_label_fr": labels[category],
        "reasons": reasons,
        "totals": {
            "activities": len(rows),
            "distance_km": round(volume_km(rows), 2),
            "moving_time_h": round(sum((a.moving_time_s or 0) for a in rows) / 3600.0, 2),
        },
        "window_28d": {
            "activities": len(recent),
            "distance_km": round(vol_recent, 2),
            "avg_pace_sec_per_km": round(_pace_sec_per_km(speed_recent) or 0, 1)
            if speed_recent
            else None,
            "avg_heartrate": round(avg_metric(recent, "average_heartrate") or 0, 1)
            if avg_metric(recent, "average_heartrate")
            else None,
            "avg_cadence_ppm": round(avg_metric(recent, "cadence_ppm") or 0, 1)
            if avg_metric(recent, "cadence_ppm")
            else None,
        },
        "previous_28d": {
            "activities": len(previous),
            "distance_km": round(vol_previous, 2),
            "avg_pace_sec_per_km": round(_pace_sec_per_km(speed_previous) or 0, 1)
            if speed_previous
            else None,
        },
        "trends": {
            "volume_pct": round(_pct_change(vol_previous if vol_previous > 0 else None, vol_recent) or 0, 1)
            if vol_previous > 0
            else None,
            "speed_pct": round(_pct_change(speed_previous, speed_recent) or 0, 1)
            if speed_previous and speed_recent
            else None,
        },
        "weekly_volume": weekly_volume,
        "weather": weather_summary,
    }

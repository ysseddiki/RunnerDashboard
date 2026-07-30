"""Analytics d'évolution running (P3)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity
from app.services.activity_features import (
    ACR_HIGH_THRESHOLD,
    EASY_SESSION_TYPES,
    QUALITY_SESSION_TYPES,
    is_running_eligible,
)
from app.services.terrains import is_roadish

MIN_ACTIVITIES = 5
MIN_HR_WEATHER_SAMPLES = 6
PACE_BAND_HALF_SEC = 8.0
PACE_BAND_WIDE_HALF_SEC = 12.0


def _trimp_of(activity: Activity) -> float | None:
    feat = activity.features_json if isinstance(activity.features_json, dict) else None
    if not feat:
        return None
    val = feat.get("trimp_edwards")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_load(rows: list[Activity], now: datetime) -> dict[str, Any]:
    with_trimp = [(a, _trimp_of(a)) for a in rows]
    available = [(a, t) for a, t in with_trimp if t is not None]
    if not available:
        return {
            "available": False,
            "trimp_7d": None,
            "trimp_28d": None,
            "acr": None,
            "acr_elevated": False,
            "reason_fr": "TRIMP indisponible (FC + zones profil requis sur les sorties).",
        }

    def sum_days(days: int) -> float:
        start = now - timedelta(days=days)
        return sum(t for a, t in available if a.start_date and a.start_date >= start)

    t7 = round(sum_days(7), 1)
    t28 = round(sum_days(28), 1)
    # ACR = charge aiguë 7j / moyenne hebdo sur 28j
    weekly_equiv = t28 / 4.0 if t28 > 0 else 0.0
    acr = round(t7 / weekly_equiv, 2) if weekly_equiv > 0 else None
    return {
        "available": True,
        "trimp_7d": t7,
        "trimp_28d": t28,
        "acr": acr,
        "acr_elevated": bool(acr is not None and acr >= ACR_HIGH_THRESHOLD),
        "reason_fr": None,
        "sample_with_trimp": len(available),
    }


def _volume_buckets_28d(recent: list[Activity]) -> dict[str, float]:
    easy = quality = untagged = 0.0
    for a in recent:
        km = (a.distance_m or 0.0) / 1000.0
        st = a.session_type
        if st in EASY_SESSION_TYPES:
            easy += km
        elif st in QUALITY_SESSION_TYPES:
            quality += km
        else:
            untagged += km
    return {
        "volume_easy_km_28d": round(easy, 2),
        "volume_quality_km_28d": round(quality, 2),
        "volume_untagged_km_28d": round(untagged, 2),
    }


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


def _fmt_pace_band(lo: float, hi: float) -> str:
    def one(sec: float) -> str:
        mm = int(sec // 60)
        ss = int(round(sec % 60))
        if ss == 60:
            mm += 1
            ss = 0
        return f"{mm}:{ss:02d}"

    return f"{one(lo)}–{one(hi)} /km"


def _linear_slope(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 4 or len(xs) != len(ys):
        return None
    mx = mean(xs)
    my = mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    if den < 1e-6:
        return None
    return num / den


def _eligible_hr_weather(rows: list[Activity]) -> list[dict[str, float]]:
    """Points (pace, hr, temp) filtrés route-ish, ≥3 km."""
    out: list[dict[str, float]] = []
    for a in rows:
        if not is_roadish(getattr(a, "terrain", None)):
            continue
        if (a.distance_m or 0) < 3000:
            continue
        if a.average_heartrate is None or a.average_heartrate <= 0:
            continue
        pace = _pace_sec_per_km(a.average_speed_mps)
        if pace is None or pace < 150 or pace > 480:
            continue
        w = a.weather_json if isinstance(a.weather_json, dict) else None
        if not w or w.get("temperature_c") is None:
            continue
        # Exclure D+ trop marqué même sans tag trail
        km = (a.distance_m or 0) / 1000.0
        elev = a.total_elevation_gain_m or 0.0
        if km > 0 and elev / km >= 50:
            continue
        out.append(
            {
                "pace": float(pace),
                "hr": float(a.average_heartrate),
                "temp": float(w["temperature_c"]),
            }
        )
    return out


def build_hr_weather_at_pace(rows: list[Activity]) -> dict[str, Any]:
    """Variance FC à allure comparable selon la température (déterministe)."""
    points = _eligible_hr_weather(rows)
    base = {
        "available": False,
        "sample_size": 0,
        "eligible_with_hr_weather": len(points),
        "pace_band_sec_per_km": None,
        "pace_band_label_fr": None,
        "buckets": [],
        "hr_delta_warm_vs_cool_bpm": None,
        "slope_bpm_per_c": None,
        "confidence": "basse",
        "confidence_label_fr": "Basse",
        "notes_fr": [],
        "filters_fr": "Route/piste, ≥3 km, FC + température, D+ faible",
        "reason_fr": None,
    }
    if len(points) < MIN_HR_WEATHER_SAMPLES:
        base["reason_fr"] = (
            f"Pas assez de sorties comparables ({len(points)}/{MIN_HR_WEATHER_SAMPLES} "
            "avec FC + météo sur terrain route)."
        )
        return base

    paces = sorted(p["pace"] for p in points)
    center = paces[len(paces) // 2]

    def in_band(half: float) -> list[dict[str, float]]:
        return [p for p in points if abs(p["pace"] - center) <= half]

    band = in_band(PACE_BAND_HALF_SEC)
    half_used = PACE_BAND_HALF_SEC
    if len(band) < MIN_HR_WEATHER_SAMPLES:
        band = in_band(PACE_BAND_WIDE_HALF_SEC)
        half_used = PACE_BAND_WIDE_HALF_SEC
    if len(band) < MIN_HR_WEATHER_SAMPLES:
        base["reason_fr"] = (
            f"Trop peu de sorties dans une même bande d’allure ({len(band)} autour de "
            f"{_fmt_pace_band(center - half_used, center + half_used)})."
        )
        base["eligible_with_hr_weather"] = len(points)
        return base

    lo = center - half_used
    hi = center + half_used
    cool = [p for p in band if p["temp"] < 12]
    mild = [p for p in band if 12 <= p["temp"] < 20]
    warm = [p for p in band if p["temp"] >= 20]

    def bucket(bid: str, label: str, items: list[dict[str, float]]) -> dict[str, Any]:
        return {
            "id": bid,
            "label_fr": label,
            "n": len(items),
            "avg_hr": round(_avg([p["hr"] for p in items]) or 0, 1) if items else None,
            "avg_temp_c": round(_avg([p["temp"] for p in items]) or 0, 1) if items else None,
        }

    buckets = [
        bucket("cool", "Frais (< 12 °C)", cool),
        bucket("mild", "Doux (12–20 °C)", mild),
        bucket("warm", "Chaud (≥ 20 °C)", warm),
    ]

    hr_cool = _avg([p["hr"] for p in cool])
    hr_warm = _avg([p["hr"] for p in warm])
    delta = None
    if hr_cool is not None and hr_warm is not None and len(cool) >= 2 and len(warm) >= 2:
        delta = round(hr_warm - hr_cool, 1)

    slope = _linear_slope([p["temp"] for p in band], [p["hr"] for p in band])
    slope_r = round(slope, 2) if slope is not None else None

    conf = "basse"
    if len(band) >= 20 and len(cool) >= 5 and len(warm) >= 5:
        conf = "haute"
    elif len(band) >= 10 and len(cool) >= 3 and len(warm) >= 3:
        conf = "moyenne"
    elif len(band) >= 10 and slope_r is not None:
        conf = "moyenne"

    conf_labels = {"haute": "Haute", "moyenne": "Moyenne", "basse": "Basse"}
    notes: list[str] = []
    if delta is not None:
        if delta >= 3:
            notes.append(
                f"À allure comparable, FC moyenne +{delta:.0f} bpm par temps chaud vs frais."
            )
        elif delta <= -3:
            notes.append(
                f"À allure comparable, FC moyenne {delta:.0f} bpm par temps chaud vs frais "
                "(signal atypique — vérifier échantillon)."
            )
        else:
            notes.append(
                "À allure comparable, peu d’écart FC entre frais et chaud (±3 bpm)."
            )
    if slope_r is not None and abs(slope_r) >= 0.25:
        direction = "hausse" if slope_r > 0 else "baisse"
        notes.append(
            f"Tendance linéaire : environ {abs(slope_r):.2f} bpm de {direction} par °C "
            f"(n={len(band)})."
        )
    if not notes:
        notes.append(
            "Échantillon encore mince pour conclure sur la sensibilité FC × température."
        )

    return {
        "available": True,
        "sample_size": len(band),
        "eligible_with_hr_weather": len(points),
        "pace_band_sec_per_km": {
            "low": round(lo, 1),
            "high": round(hi, 1),
            "center": round(center, 1),
        },
        "pace_band_label_fr": _fmt_pace_band(lo, hi),
        "buckets": buckets,
        "hr_delta_warm_vs_cool_bpm": delta,
        "slope_bpm_per_c": slope_r,
        "confidence": conf,
        "confidence_label_fr": conf_labels[conf],
        "notes_fr": notes,
        "filters_fr": "Route/piste, ≥3 km, FC + température, D+ faible",
        "reason_fr": None,
    }


def build_overview(db: Session, user_id: int) -> dict[str, Any]:
    all_rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.user_id == user_id)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.asc())
        ).all()
    )
    # Pool running pour tendances / catégorie / charge
    rows = [a for a in all_rows if is_running_eligible(a)]

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

    # Volumes hebdomadaires (12 dernières semaines) — running only
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
    weeks_before = max((42 / 7), 1)
    avg_14_equivalent = (volume_km(before_14) / weeks_before) * 2

    load = _build_load(rows, now)

    category = "donnees_insuffisantes"
    reasons: list[str] = []
    if len(rows) < MIN_ACTIVITIES:
        reasons.append(
            f"Seulement {len(rows)} sortie(s) running (minimum {MIN_ACTIVITIES})."
        )
    else:
        vol_change = _pct_change(vol_previous if vol_previous > 0 else None, vol_recent)
        speed_change = _pct_change(speed_previous, speed_recent)

        volume_spike = avg_14_equivalent > 0 and vol_14 > avg_14_equivalent * 1.35
        acr_high = bool(load.get("acr_elevated"))

        if volume_spike or acr_high:
            category = "charge_elevee"
            if volume_spike:
                reasons.append(
                    f"Volume 14 j ({vol_14:.1f} km) nettement au-dessus de la référence "
                    f"({avg_14_equivalent:.1f} km)."
                )
            if acr_high and load.get("acr") is not None:
                reasons.append(
                    f"Ratio charge aiguë/chronique élevé (ACR {load['acr']}, seuil {ACR_HIGH_THRESHOLD})."
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

    # Météo (running)
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

    pace_recent = _pace_sec_per_km(speed_recent) if speed_recent else None
    pace_previous = _pace_sec_per_km(speed_previous) if speed_previous else None
    pace_gain_sec = None
    if pace_recent is not None and pace_previous is not None:
        pace_gain_sec = round(pace_previous - pace_recent, 1)

    hr_recent = avg_metric(recent, "average_heartrate")
    hr_previous = avg_metric(previous, "average_heartrate")
    hr_delta = None
    if hr_recent is not None and hr_previous is not None:
        hr_delta = round(hr_recent - hr_previous, 1)

    max_hr_recent = avg_metric(recent, "max_heartrate")
    cadence_recent = avg_metric(recent, "cadence_ppm")
    cadence_previous = avg_metric(previous, "cadence_ppm")

    elev_total = sum((a.total_elevation_gain_m or 0.0) for a in rows)
    elev_28 = sum((a.total_elevation_gain_m or 0.0) for a in recent)

    insight_notes: list[str] = []
    if pace_gain_sec is not None:
        if pace_gain_sec >= 2:
            insight_notes.append(
                f"Allure moyenne : {pace_gain_sec:.0f} s/km gagnées vs les 28 j précédents."
            )
        elif pace_gain_sec <= -2:
            insight_notes.append(
                f"Allure moyenne : {abs(pace_gain_sec):.0f} s/km perdues vs les 28 j précédents."
            )
        else:
            insight_notes.append("Allure moyenne stable (±2 s/km) sur 28 j.")
    if hr_delta is not None and hr_recent is not None:
        if hr_delta <= -3:
            insight_notes.append(
                f"FC moyenne en baisse ({hr_delta:+.0f} bpm) — meilleure économie possible."
            )
        elif hr_delta >= 3:
            insight_notes.append(
                f"FC moyenne en hausse ({hr_delta:+.0f} bpm) — charge / intensité à surveiller."
            )
        else:
            insight_notes.append(f"FC moyenne stable autour de {hr_recent:.0f} bpm.")
    if pace_gain_sec is not None and hr_delta is not None:
        if pace_gain_sec >= 2 and hr_delta <= 0:
            insight_notes.append(
                "Plus rapide à FC égale ou plus basse : bon signal de forme."
            )
        elif pace_gain_sec <= -2 and hr_delta >= 3:
            insight_notes.append(
                "Plus lent avec FC plus haute : fatigue ou charge élevée probable."
            )

    volume_buckets = _volume_buckets_28d(recent)

    from app.services.training_load import build_form_snapshot

    form = build_form_snapshot(db, user_id, now=now)

    return {
        "category": category,
        "category_label_fr": labels[category],
        "reasons": reasons,
        "running_eligible_count": len(rows),
        "form": form,
        "totals": {
            "activities": len(rows),
            "distance_km": round(volume_km(rows), 2),
            "moving_time_h": round(sum((a.moving_time_s or 0) for a in rows) / 3600.0, 2),
            "elevation_gain_m": round(elev_total, 0),
        },
        "window_28d": {
            "activities": len(recent),
            "distance_km": round(vol_recent, 2),
            "avg_pace_sec_per_km": round(pace_recent, 1) if pace_recent else None,
            "avg_heartrate": round(hr_recent, 1) if hr_recent else None,
            "avg_max_heartrate": round(max_hr_recent, 1) if max_hr_recent else None,
            "avg_cadence_ppm": round(cadence_recent, 1) if cadence_recent else None,
            "elevation_gain_m": round(elev_28, 0),
        },
        "previous_28d": {
            "activities": len(previous),
            "distance_km": round(vol_previous, 2),
            "avg_pace_sec_per_km": round(pace_previous, 1) if pace_previous else None,
            "avg_heartrate": round(hr_previous, 1) if hr_previous else None,
            "avg_cadence_ppm": round(cadence_previous, 1) if cadence_previous else None,
        },
        "deltas": {
            "pace_gain_sec_per_km": pace_gain_sec,
            "heartrate_bpm": hr_delta,
            "volume_pct": round(_pct_change(vol_previous if vol_previous > 0 else None, vol_recent) or 0, 1)
            if vol_previous > 0
            else None,
            "speed_pct": round(_pct_change(speed_previous, speed_recent) or 0, 1)
            if speed_previous and speed_recent
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
        "insight_notes_fr": insight_notes,
        "weekly_volume": weekly_volume,
        "weather": weather_summary,
        "hr_weather": build_hr_weather_at_pace(rows),
        "load": load,
        **volume_buckets,
    }

"""Prévisions d’allure déterministes (Riegel + ancres + charge)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity
from app.services.analytics import build_overview as build_analytics_overview
from app.services.session_types import label_for

MIN_ACTIVITIES = 5
RIEGEL_EXP = 0.06
PACE_MIN = 150.0  # 2:30 /km
PACE_MAX = 480.0  # 8:00 /km

TARGET_DISTANCES: tuple[tuple[str, float, str], ...] = (
    ("5k", 5.0, "5 km"),
    ("10k", 10.0, "10 km"),
    ("semi", 21.0975, "Semi-marathon"),
    ("marathon", 42.195, "Marathon"),
)

QUALITY_TYPES = frozenset(
    {"seuil", "tempo", "fractionne", "vma", "competition", "test", "cotes", "fartlek"}
)
ANCHOR_TYPES = frozenset({"competition", "test"})
EASY_TYPES = frozenset({"ef", "recuperation"})

TRAINING_FACTORS: dict[str, float] = {
    "ef": 1.20,
    "recuperation": 1.22,
    "endurance_active": 1.12,
    "sortie_longue": 1.12,
    "tempo": 1.04,
    "seuil": 1.02,
    "fractionne": 0.92,
    "vma": 0.90,
    "cotes": 1.00,
    "fartlek": 1.00,
    "competition": 1.00,
    "test": 0.95,
    "autre": 1.08,
}

Confidence = Literal["haute", "moyenne", "basse"]


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return 1000.0 / mps


def _clamp_pace(pace: float) -> float:
    return max(PACE_MIN, min(PACE_MAX, pace))


def _riegel_pace(pace_sec: float, from_km: float, to_km: float) -> float:
    if from_km <= 0 or to_km <= 0:
        return _clamp_pace(pace_sec)
    return _clamp_pace(pace_sec * ((to_km / from_km) ** RIEGEL_EXP))


def _week_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _finish_seconds(activity: Activity) -> float | None:
    pace = _pace_sec_per_km(activity.average_speed_mps)
    km = (activity.distance_m or 0) / 1000.0
    if pace is None or km < 3.0:
        return None
    return pace * km


def _load_activities(db: Session) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.asc())
        ).all()
    )


def _volume_km(items: list[Activity]) -> float:
    return sum((a.distance_m or 0.0) for a in items) / 1000.0


def _charge_adjustment(rows: list[Activity], as_of: datetime) -> float:
    """Facteur multiplicatif sur l’allure (>1 = plus lent / prudent)."""
    recent = [a for a in rows if a.start_date and as_of - timedelta(days=28) <= a.start_date <= as_of]
    previous = [
        a
        for a in rows
        if a.start_date and as_of - timedelta(days=56) <= a.start_date < as_of - timedelta(days=28)
    ]
    last_14 = [a for a in rows if a.start_date and as_of - timedelta(days=14) <= a.start_date <= as_of]
    before_14 = [
        a
        for a in rows
        if a.start_date and as_of - timedelta(days=56) <= a.start_date < as_of - timedelta(days=14)
    ]

    adj = 1.0
    vol_14 = _volume_km(last_14)
    weeks_before = max(42 / 7, 1)
    avg_14_eq = (_volume_km(before_14) / weeks_before) * 2
    if avg_14_eq > 0 and vol_14 > avg_14_eq * 1.35:
        adj *= 1.02

    def avg_speed(items: list[Activity]) -> float | None:
        vals = [a.average_speed_mps for a in items if a.average_speed_mps and a.average_speed_mps > 0]
        return mean(vals) if vals else None

    sp_r = avg_speed(recent)
    sp_p = avg_speed(previous)
    if sp_r and sp_p and sp_p > 0:
        change = (sp_r - sp_p) / sp_p
        if change <= -0.03:
            adj *= 1.02
        elif change >= 0.03:
            adj *= 0.99
    return adj


def _pick_anchor(
    rows: list[Activity],
    *,
    as_of: datetime,
) -> tuple[Activity | None, str, Confidence]:
    """Retourne (activité ancre, méthode, confiance de base)."""
    usable = [
        a
        for a in rows
        if a.start_date
        and a.start_date <= as_of
        and a.average_speed_mps
        and a.average_speed_mps > 0
        and (a.distance_m or 0) >= 3000
    ]
    if not usable:
        return None, "aucune", "basse"

    def best_by_finish(cands: list[Activity]) -> Activity | None:
        scored = [(a, _finish_seconds(a)) for a in cands]
        scored = [(a, t) for a, t in scored if t is not None]
        if not scored:
            return None
        # Meilleure perf ≈ plus petit temps ramené à 10 km via Riegel inverse? 
        # On prend la meilleure allure (plus rapide) parmi les candidats.
        return min(scored, key=lambda x: _pace_sec_per_km(x[0].average_speed_mps) or 9999)[0]

    # 1) compétition / test ≤ 180 j
    races = [
        a
        for a in usable
        if a.session_type in ANCHOR_TYPES and a.start_date and a.start_date >= as_of - timedelta(days=180)
    ]
    race = best_by_finish(races)
    if race is not None:
        age = (as_of - race.start_date).days if race.start_date else 999
        conf: Confidence = "haute" if age <= 120 and len(usable) >= 8 else "moyenne"
        return race, "competition_ou_test", conf

    # 2) qualité taguée ≤ 90 j
    quality = [
        a
        for a in usable
        if a.session_type in QUALITY_TYPES and a.start_date and a.start_date >= as_of - timedelta(days=90)
    ]
    q = best_by_finish(quality)
    if q is not None:
        return q, "seance_qualite", "moyenne"

    # 3) meilleures sorties ≥ 5 km hors récup (28–90 j)
    mid = [
        a
        for a in usable
        if (a.distance_m or 0) >= 5000
        and a.start_date
        and as_of - timedelta(days=90) <= a.start_date <= as_of
        and a.session_type not in EASY_TYPES
    ]
    if not mid:
        mid = [
            a
            for a in usable
            if (a.distance_m or 0) >= 5000
            and a.start_date
            and as_of - timedelta(days=90) <= a.start_date <= as_of
        ]
    m = best_by_finish(mid)
    if m is not None:
        return m, "meilleure_sortie_recente", "basse"

    # 4) fallback toute sortie récente ≥ 3 km
    recent = [
        a
        for a in usable
        if a.start_date and a.start_date >= as_of - timedelta(days=90)
    ]
    r = best_by_finish(recent) or best_by_finish(usable)
    return r, "moyenne_recente", "basse"


def _band(pace: float, confidence: Confidence) -> tuple[float, float]:
    pct = {"haute": 0.03, "moyenne": 0.05, "basse": 0.08}[confidence]
    return _clamp_pace(pace * (1 - pct)), _clamp_pace(pace * (1 + pct))


def _estimate_for_rows(
    rows: list[Activity],
    *,
    as_of: datetime | None = None,
) -> dict[str, Any] | None:
    now = as_of or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    filtered = [a for a in rows if a.start_date and a.start_date <= now]
    anchor, method, confidence = _pick_anchor(filtered, as_of=now)
    if anchor is None:
        return None

    pace = _pace_sec_per_km(anchor.average_speed_mps)
    km = (anchor.distance_m or 0) / 1000.0
    if pace is None or km <= 0:
        return None

    if len(filtered) < MIN_ACTIVITIES:
        confidence = "basse"

    adj = _charge_adjustment(filtered, now)
    pace_adj = _clamp_pace(pace * adj)

    estimates = []
    for dist_id, dist_km, label in TARGET_DISTANCES:
        p = _riegel_pace(pace_adj, km, dist_km)
        low, high = _band(p, confidence)
        finish = p * dist_km
        estimates.append(
            {
                "id": dist_id,
                "label_fr": label,
                "distance_km": dist_km,
                "pace_sec_per_km": round(p, 1),
                "pace_low_sec_per_km": round(low, 1),
                "pace_high_sec_per_km": round(high, 1),
                "finish_time_s": round(finish, 0),
                "confidence": confidence,
            }
        )

    return {
        "estimates": estimates,
        "confidence": confidence,
        "anchor": {
            "activity_id": anchor.id,
            "name": anchor.name,
            "start_date": anchor.start_date.isoformat() if anchor.start_date else None,
            "distance_km": round(km, 2),
            "pace_sec_per_km": round(pace, 1),
            "session_type": anchor.session_type,
            "session_type_label_fr": label_for(anchor.session_type),
            "method": method,
            "charge_factor": round(adj, 3),
        },
    }


def _training_paces(
    rows: list[Activity],
    pace_10k: float | None,
    *,
    as_of: datetime,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    recent_cut = as_of - timedelta(days=120)
    for type_id, factor in TRAINING_FACTORS.items():
        if type_id in {"competition", "test", "autre"}:
            continue
        tagged = [
            a
            for a in rows
            if a.session_type == type_id
            and a.start_date
            and a.start_date <= as_of
            and a.start_date >= recent_cut
            and a.average_speed_mps
            and a.average_speed_mps > 0
            and (a.distance_m or 0) >= 2000
        ]
        tagged.sort(key=lambda a: a.start_date or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        sample = tagged[:6]
        source = "derive_10k"
        pace: float | None = None
        if sample:
            paces = [_pace_sec_per_km(a.average_speed_mps) for a in sample]
            vals = [p for p in paces if p is not None]
            if vals:
                pace = mean(vals)
                source = "observe"
        if pace is None and pace_10k is not None:
            pace = _clamp_pace(pace_10k * factor)
            source = "derive_10k"
        if pace is None:
            continue
        out.append(
            {
                "session_type": type_id,
                "label_fr": label_for(type_id) or type_id,
                "pace_sec_per_km": round(pace, 1),
                "source": source,
                "sample_size": len(sample) if source == "observe" else 0,
            }
        )
    return out


def _trend_10k(rows: list[Activity], *, weeks: int = 12) -> list[dict[str, Any]]:
    if not rows:
        return []
    now = datetime.now(timezone.utc)
    # Fin de chaque semaine ISO sur les N dernières semaines
    points: list[dict[str, Any]] = []
    # Start from (weeks-1) weeks ago Monday-ish via isocalendar
    for back in range(weeks - 1, -1, -1):
        ref = now - timedelta(weeks=back)
        iso = ref.isocalendar()
        # End of that ISO week = Sunday 23:59 UTC approx: Thursday + 3 days... use ref end of day
        # Use last moment of that week: next Monday - 1s
        # Simple: use Wednesday of that week as representative "as_of"
        # Better: find max start_date in that week among activities, else end of week
        week_label = f"{iso.year}-W{iso.week:02d}"
        # Approximate end of ISO week (Monday=1): Sunday = Monday + 6 days
        # Python: date.fromisocalendar
        from datetime import date

        week_end_date = date.fromisocalendar(iso.year, iso.week, 7)
        as_of = datetime(
            week_end_date.year,
            week_end_date.month,
            week_end_date.day,
            23,
            59,
            59,
            tzinfo=timezone.utc,
        )
        if as_of > now:
            as_of = now
        est = _estimate_for_rows(rows, as_of=as_of)
        if not est:
            continue
        pace_10 = next((e["pace_sec_per_km"] for e in est["estimates"] if e["id"] == "10k"), None)
        if pace_10 is None:
            continue
        points.append({"week": week_label, "pace_sec_per_km": pace_10})
    return points


def build_predictions_overview(db: Session) -> dict[str, Any]:
    rows = _load_activities(db)
    warnings: list[str] = []
    now = datetime.now(timezone.utc)

    if len(rows) < MIN_ACTIVITIES:
        warnings.append(
            f"Seulement {len(rows)} sortie(s) (minimum conseillé {MIN_ACTIVITIES}) — confiance basse."
        )

    tagged = sum(1 for a in rows if a.session_type)
    if tagged < 3:
        warnings.append(
            "Peu de types de séance tagués : classez vos sorties (compétition, seuil, EF…) "
            "pour affiner les prévisions."
        )

    races = [a for a in rows if a.session_type in ANCHOR_TYPES]
    if not races:
        warnings.append(
            "Aucune compétition / test tagué : l’ancre repose sur des sorties d’entraînement."
        )

    core = _estimate_for_rows(rows, as_of=now)
    if core is None:
        return {
            "available": False,
            "confidence": "basse",
            "confidence_label_fr": "Basse",
            "hero_distance_id": "10k",
            "estimates": [],
            "training_paces": [],
            "trend_10k": [],
            "anchor": None,
            "reasons": ["Pas assez de sorties avec allure et distance exploitables (≥ 3 km)."],
            "warnings": warnings
            + ["Impossible de calculer une ancre d’allure."],
            "activities_considered": len(rows),
            "insights": build_analytics_overview(db),
        }

    pace_10 = next((e["pace_sec_per_km"] for e in core["estimates"] if e["id"] == "10k"), None)
    training = _training_paces(rows, pace_10, as_of=now)
    trend = _trend_10k(rows)

    conf = core["confidence"]
    conf_labels = {"haute": "Haute", "moyenne": "Moyenne", "basse": "Basse"}
    reasons = [
        f"Ancre : {core['anchor']['name']} "
        f"({core['anchor']['distance_km']} km @ {_format_pace_human(core['anchor']['pace_sec_per_km'])}).",
        f"Méthode d’ancre : {core['anchor']['method'].replace('_', ' ')}.",
    ]
    if core["anchor"].get("charge_factor", 1) != 1:
        reasons.append(
            f"Ajustement charge / tendance : facteur {core['anchor']['charge_factor']}."
        )

    # Delta tendance 10k
    if len(trend) >= 2:
        first = trend[0]["pace_sec_per_km"]
        last = trend[-1]["pace_sec_per_km"]
        if first and last:
            # pace down = faster = improvement
            delta_pct = ((last - first) / first) * 100
            if abs(delta_pct) >= 1:
                direction = "plus rapide" if delta_pct < 0 else "plus lente"
                reasons.append(
                    f"Allure 10 km estimée {direction} de {abs(delta_pct):.1f} % sur la fenêtre tendance."
                )

    insights = build_analytics_overview(db)

    return {
        "available": True,
        "confidence": conf,
        "confidence_label_fr": conf_labels[conf],
        "hero_distance_id": "10k",
        "estimates": core["estimates"],
        "training_paces": training,
        "trend_10k": trend,
        "anchor": core["anchor"],
        "reasons": reasons,
        "warnings": warnings,
        "activities_considered": len(rows),
        "insights": insights,
    }


def _format_pace_human(sec: float) -> str:
    mm = int(sec // 60)
    ss = int(round(sec % 60))
    if ss == 60:
        mm += 1
        ss = 0
    return f"{mm}:{ss:02d} /km"

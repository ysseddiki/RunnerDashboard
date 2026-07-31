"""Tendances longitudinales par session_type (28j vs 29–84j)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Literal

from app.services.activity_features import is_running_eligible
from app.services.session_types import label_for

MIN_SAMPLES = 3
RECENT_DAYS = 28
DEFAULT_DAYS = 84
STABLE_PACE_PCT = 1.0

Direction = Literal["mieux", "stable", "moins_bon", "indetermine"]


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return 1000.0 / mps


def _feat_num(activity: Any, *keys: str) -> float | None:
    feat = getattr(activity, "features_json", None)
    if not isinstance(feat, dict):
        return None
    for key in keys:
        val = feat.get(key)
        if val is None:
            continue
        try:
            return float(val)
        except (TypeError, ValueError):
            continue
    return None


def _activity_metrics(activity: Any) -> dict[str, float | None]:
    return {
        "pace_sec_per_km": _pace_sec_per_km(getattr(activity, "average_speed_mps", None)),
        "avg_hr": (
            float(activity.average_heartrate)
            if getattr(activity, "average_heartrate", None) is not None
            else None
        ),
        "decoupling_pct": _feat_num(activity, "decoupling_pct", "decoupling"),
        "cv_pace": _feat_num(activity, "cv_pace"),
    }


def _avg_field(rows: list[Any], field: str) -> float | None:
    vals = []
    for a in rows:
        m = _activity_metrics(a)
        v = m.get(field)
        if v is not None:
            vals.append(v)
    if not vals:
        return None
    return round(mean(vals), 2)


def direction_lower_better(
    recent: float | None, prior: float | None, *, stable_pct: float = STABLE_PACE_PCT
) -> Direction:
    """Baisse = mieux (allure s/km, decoupling, cv)."""
    if recent is None or prior is None or prior == 0:
        return "indetermine"
    delta_pct = 100.0 * (recent - prior) / abs(prior)
    if abs(delta_pct) < stable_pct:
        return "stable"
    # lower is better → negative delta_pct = mieux
    if delta_pct < 0:
        return "mieux"
    return "moins_bon"


def pace_delta_pct(recent: float | None, prior: float | None) -> float | None:
    if recent is None or prior is None or prior == 0:
        return None
    # Negatif = plus rapide
    return round(100.0 * (recent - prior) / abs(prior), 2)


def trend_for_type(
    recent_rows: list[Any],
    prior_rows: list[Any],
    *,
    session_type: str,
) -> dict[str, Any]:
    n_total = len(recent_rows) + len(prior_rows)
    if n_total < MIN_SAMPLES:
        return {
            "session_type": session_type,
            "label_fr": label_for(session_type) or session_type,
            "available": False,
            "reason_fr": f"Moins de {MIN_SAMPLES} séances taguées sur la période.",
            "sample_recent": len(recent_rows),
            "sample_prior": len(prior_rows),
        }
    if not recent_rows:
        return {
            "session_type": session_type,
            "label_fr": label_for(session_type) or session_type,
            "available": False,
            "reason_fr": "Aucune séance de ce type sur les 28 derniers jours.",
            "sample_recent": 0,
            "sample_prior": len(prior_rows),
        }

    recent_m = {
        "pace_sec_per_km": _avg_field(recent_rows, "pace_sec_per_km"),
        "avg_hr": _avg_field(recent_rows, "avg_hr"),
        "decoupling_pct": _avg_field(recent_rows, "decoupling_pct"),
        "cv_pace": _avg_field(recent_rows, "cv_pace"),
    }
    prior_m = {
        "pace_sec_per_km": _avg_field(prior_rows, "pace_sec_per_km"),
        "avg_hr": _avg_field(prior_rows, "avg_hr"),
        "decoupling_pct": _avg_field(prior_rows, "decoupling_pct"),
        "cv_pace": _avg_field(prior_rows, "cv_pace"),
    }

    pace_dir = direction_lower_better(
        recent_m["pace_sec_per_km"], prior_m["pace_sec_per_km"]
    )
    # Direction principale = allure ; sinon decoupling / cv
    primary = pace_dir
    if primary == "indetermine":
        primary = direction_lower_better(
            recent_m["decoupling_pct"], prior_m["decoupling_pct"]
        )
    if primary == "indetermine":
        primary = direction_lower_better(recent_m["cv_pace"], prior_m["cv_pace"])

    return {
        "session_type": session_type,
        "label_fr": label_for(session_type) or session_type,
        "available": True,
        "reason_fr": None,
        "sample_recent": len(recent_rows),
        "sample_prior": len(prior_rows),
        "recent": recent_m,
        "prior": prior_m,
        "pace_delta_pct": pace_delta_pct(
            recent_m["pace_sec_per_km"], prior_m["pace_sec_per_km"]
        ),
        "direction": primary,
        "directions": {
            "pace": pace_dir,
            "decoupling": direction_lower_better(
                recent_m["decoupling_pct"], prior_m["decoupling_pct"]
            ),
            "cv_pace": direction_lower_better(
                recent_m["cv_pace"], prior_m["cv_pace"]
            ),
        },
    }


def build_from_activities(
    rows: list[Any],
    *,
    now: datetime | None = None,
    days: int = DEFAULT_DAYS,
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    recent_cut = now - timedelta(days=RECENT_DAYS)

    eligible = [
        a
        for a in rows
        if is_running_eligible(a)
        and getattr(a, "session_type", None)
        and getattr(a, "start_date", None)
        and a.start_date >= start
    ]

    by_type: dict[str, list[Any]] = {}
    for a in eligible:
        by_type.setdefault(a.session_type, []).append(a)

    trends: list[dict[str, Any]] = []
    for st, items in sorted(by_type.items()):
        recent = [a for a in items if a.start_date >= recent_cut]
        prior = [a for a in items if start <= a.start_date < recent_cut]
        # Si prior vide mais assez d'historique : split médian chronologique
        if not prior and len(items) >= MIN_SAMPLES:
            ordered = sorted(items, key=lambda x: x.start_date)
            mid = len(ordered) // 2
            prior = ordered[:mid]
            recent = ordered[mid:] or ordered[-1:]
        trends.append(trend_for_type(recent, prior, session_type=st))

    available_trends = [t for t in trends if t.get("available")]
    return {
        "available": len(available_trends) > 0,
        "days": days,
        "recent_days": RECENT_DAYS,
        "trends": trends,
        "reason_fr": None
        if available_trends
        else (
            "Pas assez de séances taguées par type (minimum "
            f"{MIN_SAMPLES} sur {days} j. avec au moins une récente)."
        ),
    }


def build_summary(payload: dict[str, Any], *, limit: int = 5) -> dict[str, Any]:
    """Résumé overview : types qualité + ef / longue en priorité."""
    priority = (
        "seuil",
        "tempo",
        "fractionne",
        "vma",
        "sortie_longue",
        "ef",
        "endurance_active",
        "fartlek",
        "cotes",
    )
    avail = [t for t in (payload.get("trends") or []) if t.get("available")]
    if not avail:
        return {
            "available": False,
            "items": [],
            "reason_fr": payload.get("reason_fr"),
        }

    def sort_key(t: dict[str, Any]) -> tuple[int, str]:
        st = t.get("session_type") or ""
        try:
            idx = priority.index(st)
        except ValueError:
            idx = 99
        return (idx, st)

    avail.sort(key=sort_key)
    items = [
        {
            "session_type": t["session_type"],
            "label_fr": t["label_fr"],
            "direction": t.get("direction"),
            "pace_delta_pct": t.get("pace_delta_pct"),
            "sample_recent": t.get("sample_recent"),
        }
        for t in avail[:limit]
    ]
    return {"available": True, "items": items, "reason_fr": None}


def build_trends(
    db: Any,
    user_id: int,
    *,
    days: int = DEFAULT_DAYS,
    now: datetime | None = None,
) -> dict[str, Any]:
    from sqlalchemy import select

    from app.models import Activity

    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.user_id == user_id)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.asc())
        ).all()
    )
    return build_from_activities(rows, now=now, days=days)

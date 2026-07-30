"""Charge continue : TRIMP journalier → ATL / CTL / TSB (forme)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.activity_features import is_running_eligible

if TYPE_CHECKING:
    from app.models import Activity

ATL_TAU = 7.0
CTL_TAU = 42.0
MIN_TRIMP_DAYS = 14
DEFAULT_SERIES_DAYS = 84

STATUS_LABELS = {
    "fatigue": "Fatigue",
    "productif": "Productif",
    "neutre": "Neutre",
    "frais": "Frais",
}


def _trimp_of(activity: Any) -> float | None:
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


def form_status(tsb: float) -> str:
    if tsb <= -20:
        return "fatigue"
    if tsb <= -5:
        return "productif"
    if tsb < 10:
        return "neutre"
    return "frais"


def compute_ema_series(daily: list[float]) -> list[dict[str, float]]:
    """À partir d'une liste daily_trimp chronologique, calcule ATL/CTL/TSB."""
    atl = 0.0
    ctl = 0.0
    out: list[dict[str, float]] = []
    for trimp in daily:
        atl = atl + (trimp - atl) / ATL_TAU
        ctl = ctl + (trimp - ctl) / CTL_TAU
        tsb = ctl - atl
        out.append(
            {
                "daily_trimp": round(trimp, 2),
                "atl": round(atl, 2),
                "ctl": round(ctl, 2),
                "tsb": round(tsb, 2),
            }
        )
    return out


def _day_key(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date()


def build_series(
    db: Session,
    *,
    days: int = DEFAULT_SERIES_DAYS,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Série journalière TRIMP/ATL/CTL/TSB sur `days` jours (fin = aujourd'hui UTC)."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    days = max(14, min(int(days), 365))
    end_day = _day_key(now)
    start_day = end_day - timedelta(days=days - 1)
    # Warmup : démarrer le calcul EMA 42j avant la fenêtre affichée
    from app.models import Activity

    calc_start = start_day - timedelta(days=int(CTL_TAU))

    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.start_date.is_not(None))
            .where(Activity.start_date >= datetime.combine(calc_start, datetime.min.time(), tzinfo=timezone.utc))
            .order_by(Activity.start_date.asc())
        ).all()
    )
    running = [a for a in rows if is_running_eligible(a)]

    by_day: dict[date, float] = defaultdict(float)
    trimp_days: set[date] = set()
    for a in running:
        if not a.start_date:
            continue
        d = _day_key(a.start_date)
        t = _trimp_of(a)
        if t is None:
            continue
        by_day[d] += t
        trimp_days.add(d)

    # Construire la série complète du calc_start à end_day
    full_days: list[date] = []
    d = calc_start
    while d <= end_day:
        full_days.append(d)
        d += timedelta(days=1)

    daily_vals = [float(by_day.get(day, 0.0)) for day in full_days]
    ema = compute_ema_series(daily_vals)

    # Fenêtre affichée
    display: list[dict[str, Any]] = []
    for day, point in zip(full_days, ema):
        if day < start_day:
            continue
        display.append(
            {
                "date": day.isoformat(),
                "daily_trimp": point["daily_trimp"],
                "atl": point["atl"],
                "ctl": point["ctl"],
                "tsb": point["tsb"],
            }
        )

    n_trimp = len(trimp_days)
    available = n_trimp >= MIN_TRIMP_DAYS
    warmup = n_trimp < int(CTL_TAU)

    if not available:
        return {
            "available": False,
            "days": days,
            "series": [],
            "form": None,
            "trimp_day_count": n_trimp,
            "warmup": True,
            "reason_fr": (
                f"Pas assez de jours avec TRIMP ({n_trimp}/{MIN_TRIMP_DAYS}). "
                "Besoin de sorties running avec FC et zones profil."
            ),
        }

    last = display[-1] if display else None
    status = form_status(last["tsb"]) if last else "neutre"
    form = {
        "available": True,
        "atl": last["atl"] if last else None,
        "ctl": last["ctl"] if last else None,
        "tsb": last["tsb"] if last else None,
        "status": status,
        "status_label_fr": STATUS_LABELS[status],
        "warmup": warmup,
        "warmup_note_fr": (
            "CTL encore en stabilisation (< 42 j. de charge)." if warmup else None
        ),
        "as_of": last["date"] if last else end_day.isoformat(),
        "reason_fr": None,
    }

    return {
        "available": True,
        "days": days,
        "series": display,
        "form": form,
        "trimp_day_count": n_trimp,
        "warmup": warmup,
        "reason_fr": None,
    }


def build_form_snapshot(db: Session, *, now: datetime | None = None) -> dict[str, Any]:
    """Snapshot forme pour overview (sans série complète)."""
    payload = build_series(db, days=DEFAULT_SERIES_DAYS, now=now)
    if not payload["available"] or not payload.get("form"):
        return {
            "available": False,
            "atl": None,
            "ctl": None,
            "tsb": None,
            "status": None,
            "status_label_fr": None,
            "warmup": True,
            "reason_fr": payload.get("reason_fr"),
        }
    return payload["form"]

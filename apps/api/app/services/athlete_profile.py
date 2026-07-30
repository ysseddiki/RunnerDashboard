"""Profil athlète + zones / VO2 déterministes + historique."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AthleteProfile, AthleteProfileHistory


ZONE_DEFS = (
    ("Z1", "Récupération", 0.50, 0.60),
    ("Z2", "EF / endurance", 0.60, 0.70),
    ("Z3", "Tempo / active", 0.70, 0.80),
    ("Z4", "Seuil", 0.80, 0.90),
    ("Z5", "VMA / intensité", 0.90, 1.00),
)

PROFILE_FIELDS = (
    "birth_date",
    "weight_kg",
    "height_cm",
    "sex",
    "resting_hr",
    "max_hr",
    "goal_text",
)


def get_or_create_profile(db: Session) -> AthleteProfile:
    row = db.get(AthleteProfile, 1)
    if row is None:
        row = AthleteProfile(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def age_years_from_birth(birth: date | None, *, on: date | None = None) -> int | None:
    if birth is None:
        return None
    today = on or date.today()
    years = today.year - birth.year - (
        (today.month, today.day) < (birth.month, birth.day)
    )
    if years < 0 or years > 120:
        return None
    return years


def _profile_age(profile: AthleteProfile) -> int | None:
    from_birth = age_years_from_birth(profile.birth_date)
    if from_birth is not None:
        return from_birth
    if profile.age and 10 <= profile.age <= 90:
        return int(profile.age)
    return None


def _resolved_max_hr(profile: AthleteProfile) -> int | None:
    if profile.max_hr and profile.max_hr > 0:
        return int(profile.max_hr)
    age = _profile_age(profile)
    if age is not None and 10 <= age <= 90:
        return 220 - age
    return None


def compute_zones(profile: AthleteProfile) -> dict[str, Any]:
    max_hr = _resolved_max_hr(profile)
    if max_hr is None:
        return {
            "available": False,
            "method": None,
            "zones": [],
            "reason_fr": "Renseignez fc_max ou la date de naissance pour estimer les zones.",
        }
    resting = profile.resting_hr if profile.resting_hr and profile.resting_hr > 0 else None
    zones = []
    if resting is not None and resting < max_hr:
        reserve = max_hr - resting
        method = "karvonen"
        for zid, name, lo, hi in ZONE_DEFS:
            zones.append(
                {
                    "id": zid,
                    "label_fr": name,
                    "hr_low": round(resting + reserve * lo),
                    "hr_high": round(resting + reserve * hi),
                }
            )
    else:
        method = "pct_max"
        for zid, name, lo, hi in ZONE_DEFS:
            zones.append(
                {
                    "id": zid,
                    "label_fr": name,
                    "hr_low": round(max_hr * lo),
                    "hr_high": round(max_hr * hi),
                }
            )
    return {
        "available": True,
        "method": method,
        "max_hr_used": max_hr,
        "resting_hr_used": resting,
        "zones": zones,
        "reason_fr": None,
    }


def estimate_vo2max(profile: AthleteProfile) -> dict[str, Any]:
    """Approximation Uth–Sørensen : 15.3 × (max_hr / resting_hr)."""
    max_hr = _resolved_max_hr(profile)
    resting = profile.resting_hr
    if max_hr and resting and resting > 0 and max_hr > resting:
        vo2 = 15.3 * (max_hr / resting)
        return {
            "available": True,
            "vo2max_ml_kg_min": round(vo2, 1),
            "method": "uth_sorensen",
            "reason_fr": None,
        }
    return {
        "available": False,
        "vo2max_ml_kg_min": None,
        "method": None,
        "reason_fr": "Besoin de fc_repos et fc_max (ou date de naissance) pour estimer la VO2max.",
    }


def _parse_birth_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    raise ValueError("birth_date invalide")


def _snapshot_dict(row: AthleteProfile) -> dict[str, Any]:
    age = _profile_age(row)
    return {
        "birth_date": row.birth_date.isoformat() if row.birth_date else None,
        "age": age,
        "weight_kg": row.weight_kg,
        "height_cm": row.height_cm,
        "sex": row.sex,
        "resting_hr": row.resting_hr,
        "max_hr": row.max_hr,
        "goal_text": row.goal_text,
    }


def _values_equal(a: Any, b: Any) -> bool:
    if isinstance(a, float) and isinstance(b, float):
        return abs(a - b) < 1e-6
    return a == b


def _append_history(db: Session, row: AthleteProfile) -> None:
    snap = AthleteProfileHistory(
        recorded_at=datetime.now(timezone.utc),
        birth_date=row.birth_date,
        age_years=_profile_age(row),
        weight_kg=row.weight_kg,
        height_cm=row.height_cm,
        sex=row.sex,
        resting_hr=row.resting_hr,
        max_hr=row.max_hr,
        goal_text=row.goal_text,
    )
    db.add(snap)


def list_history(db: Session, *, limit: int = 50) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(AthleteProfileHistory)
        .order_by(AthleteProfileHistory.recorded_at.desc())
        .limit(limit)
    ).all()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
                "birth_date": r.birth_date.isoformat() if r.birth_date else None,
                "age": r.age_years,
                "weight_kg": r.weight_kg,
                "height_cm": r.height_cm,
                "sex": r.sex,
                "resting_hr": r.resting_hr,
                "max_hr": r.max_hr,
                "goal_text": r.goal_text,
            }
        )
    return out


def profile_payload(db: Session) -> dict[str, Any]:
    row = get_or_create_profile(db)
    zones = compute_zones(row)
    vo2 = estimate_vo2max(row)
    return {
        **_snapshot_dict(row),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "zones": zones,
        "vo2max": vo2,
        "history": list_history(db),
    }


def update_profile(db: Session, data: dict[str, Any]) -> dict[str, Any]:
    row = get_or_create_profile(db)
    before = {k: getattr(row, k) for k in PROFILE_FIELDS}

    if "birth_date" in data:
        row.birth_date = _parse_birth_date(data["birth_date"])
        # Keep legacy age column in sync when DOB is set.
        row.age = _profile_age(row)

    for key in ("weight_kg", "height_cm", "sex", "resting_hr", "max_hr", "goal_text"):
        if key in data:
            setattr(row, key, data[key])

    changed = any(not _values_equal(before[k], getattr(row, k)) for k in PROFILE_FIELDS)
    if changed:
        _append_history(db, row)

    db.commit()
    db.refresh(row)

    # Recalcul features si zones FC impactées
    from app.services import activity_features as features_service

    if features_service.zones_fields_changed(before, row):
        features_service.recompute_features_batch(db, force=True)

    return profile_payload(db)

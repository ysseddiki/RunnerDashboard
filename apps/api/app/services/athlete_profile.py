"""Profil athlète + zones / VO2 déterministes."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AthleteProfile


ZONE_DEFS = (
    ("Z1", "Récupération", 0.50, 0.60),
    ("Z2", "EF / endurance", 0.60, 0.70),
    ("Z3", "Tempo / active", 0.70, 0.80),
    ("Z4", "Seuil", 0.80, 0.90),
    ("Z5", "VMA / intensité", 0.90, 1.00),
)


def get_or_create_profile(db: Session) -> AthleteProfile:
    row = db.get(AthleteProfile, 1)
    if row is None:
        row = AthleteProfile(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _resolved_max_hr(profile: AthleteProfile) -> int | None:
    if profile.max_hr and profile.max_hr > 0:
        return int(profile.max_hr)
    if profile.age and 10 <= profile.age <= 90:
        return 220 - int(profile.age)
    return None


def compute_zones(profile: AthleteProfile) -> dict[str, Any]:
    max_hr = _resolved_max_hr(profile)
    if max_hr is None:
        return {
            "available": False,
            "method": None,
            "zones": [],
            "reason_fr": "Renseignez fc_max ou l’âge pour estimer les zones.",
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
    """Estimation prudente : formule simple âge/sexe si poids connu, sinon null.

    Note : documentée dans knowledge ; pas une lab VO2.
    Approximation type « 15 × (max_hr / resting_hr) » (Uth–Sørensen) si repos+max.
    """
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
        "reason_fr": "Besoin de fc_repos et fc_max (ou âge) pour estimer la VO2max.",
    }


def profile_payload(db: Session) -> dict[str, Any]:
    row = get_or_create_profile(db)
    zones = compute_zones(row)
    vo2 = estimate_vo2max(row)
    return {
        "age": row.age,
        "weight_kg": row.weight_kg,
        "height_cm": row.height_cm,
        "sex": row.sex,
        "resting_hr": row.resting_hr,
        "max_hr": row.max_hr,
        "goal_text": row.goal_text,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "zones": zones,
        "vo2max": vo2,
    }


def update_profile(db: Session, data: dict[str, Any]) -> dict[str, Any]:
    row = get_or_create_profile(db)
    for key in (
        "age",
        "weight_kg",
        "height_cm",
        "sex",
        "resting_hr",
        "max_hr",
        "goal_text",
    ):
        if key in data:
            setattr(row, key, data[key])
    db.commit()
    db.refresh(row)
    return profile_payload(db)

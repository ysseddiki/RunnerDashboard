"""Adhérence plan coach ↔ activités réalisées."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.activity_features import is_running_eligible
from app.services.session_types import label_for

REST_SESSION_TYPES = frozenset({"recuperation", "repos", "rest", "off"})
HARD_SESSION_TYPES = frozenset(
    {"vma", "seuil", "fractionne", "cotes", "competition", "tempo", "specific"}
)


def _is_rest_item(item: dict[str, Any]) -> bool:
    """Jour de repos / vide prévu au plan (pas une vraie séance à matcher)."""
    st = str(item.get("session_type") or "").strip().lower()
    if st in REST_SESSION_TYPES:
        return True
    blob = f"{item.get('title') or ''} {item.get('details') or ''}".lower()
    if any(
        key in blob
        for key in ("repos", "jour off", "rest day", "jour de repos", "récupération totale")
    ):
        return True
    if not st:
        dod = item.get("duration_or_distance")
        if dod is None or str(dod).strip() == "":
            return True
    return False


def _raw_plan(db: Session, user_id: int) -> dict[str, Any]:
    """Lit le plan sans adhérence (évite récursion)."""
    from app.services.coach_plan import get_plan

    return get_plan(db, user_id, with_adherence=False)


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    s = str(value).strip()[:10]
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _activity_day(a: Any) -> date | None:
    if not a.start_date:
        return None
    dt = a.start_date
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date()


def _parse_distance_km(text: Any) -> float | None:
    if text is None:
        return None
    s = str(text).lower().replace(",", ".")
    m = re.search(r"(\d+(?:\.\d+)?)\s*km", s)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if m:
        val = float(m.group(1))
        # Heuristique : > 30 probablement minutes, ignore
        if val <= 50:
            return val
    return None


def _match_score(
    item: dict[str, Any],
    activity: Any,
    plan_day: date,
) -> tuple[int, bool]:
    """Retourne (score, type_match)."""
    act_day = _activity_day(activity)
    if act_day is None:
        return 0, False
    score = 0
    if act_day == plan_day:
        score += 1
    elif abs((act_day - plan_day).days) == 1:
        score += 0  # dans la fenêtre mais pas bonus jour exact
    else:
        return 0, False

    type_match = False
    st = item.get("session_type")
    if st and activity.session_type == st:
        score += 2
        type_match = True
    elif st and activity.session_type and activity.session_type != st:
        type_match = False
    elif not st:
        # pas de type plan : matching faible possible via volume
        pass

    planned_km = _parse_distance_km(item.get("duration_or_distance"))
    act_km = (activity.distance_m or 0) / 1000.0
    if planned_km and act_km > 0:
        ratio = abs(act_km - planned_km) / max(planned_km, 0.1)
        if ratio <= 0.25:
            score += 1

    return score, type_match


def build_adherence(
    db: Session,
    user_id: int,
    *,
    now: datetime | None = None,
    activities: list[Any] | None = None,
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    today = now.astimezone(timezone.utc).date()

    plan_payload = _raw_plan(db, user_id)
    raw_items = plan_payload.get("plan") or []
    if not isinstance(raw_items, list) or not raw_items:
        return {
            "available": False,
            "adherence_pct": None,
            "matched": 0,
            "missed": 0,
            "upcoming": 0,
            "today": 0,
            "rest_ok": 0,
            "planned_past": 0,
            "items": [],
            "missed_titles": [],
            "reason_fr": "Aucun plan coach disponible pour mesurer l’adhérence.",
            "plan_updated_at": plan_payload.get("updated_at"),
        }

    dated_items: list[tuple[int, dict[str, Any], date]] = []
    skipped = 0
    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            skipped += 1
            continue
        d = _parse_date(item.get("date"))
        if d is None:
            skipped += 1
            continue
        dated_items.append((idx, item, d))

    if not dated_items:
        return {
            "available": False,
            "adherence_pct": None,
            "matched": 0,
            "missed": 0,
            "upcoming": 0,
            "today": 0,
            "rest_ok": 0,
            "planned_past": 0,
            "items": [],
            "missed_titles": [],
            "reason_fr": "Le plan n’a pas de dates exploitables.",
            "warnings_fr": ["Items sans date exclus du score."] if skipped else [],
            "plan_updated_at": plan_payload.get("updated_at"),
        }

    min_d = min(d for _, _, d in dated_items) - timedelta(days=1)
    max_d = max(d for _, _, d in dated_items) + timedelta(days=1)
    if activities is None:
        from app.models import Activity

        activities = [
            a
            for a in db.scalars(
                select(Activity)
                .where(Activity.user_id == user_id)
                .where(Activity.start_date.is_not(None))
                .where(
                    Activity.start_date
                    >= datetime.combine(min_d, datetime.min.time(), tzinfo=timezone.utc)
                )
                .where(
                    Activity.start_date
                    <= datetime.combine(
                        max_d + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
                    )
                )
                .order_by(Activity.start_date.asc())
            ).all()
            if is_running_eligible(a)
        ]
    else:
        activities = [a for a in activities if is_running_eligible(a)]

    # Candidats par jour
    by_day: dict[date, list[Any]] = {}
    for a in activities:
        d = _activity_day(a)
        if d:
            by_day.setdefault(d, []).append(a)

    # Greedy : scorés (item_idx, activity, score, type_match) triés
    candidates: list[tuple[int, Any, int, bool, date]] = []
    for idx, item, plan_day in dated_items:
        window_days = [plan_day - timedelta(days=1), plan_day, plan_day + timedelta(days=1)]
        for wd in window_days:
            for a in by_day.get(wd, []):
                score, type_match = _match_score(item, a, plan_day)
                if score >= 2:
                    candidates.append((idx, a, score, type_match, plan_day))

    candidates.sort(key=lambda x: (-x[2], abs(((_activity_day(x[1]) or x[4]) - x[4]).days)))

    used_activities: set[int] = set()
    used_items: set[int] = set()
    matches: dict[int, tuple[Any, int, bool]] = {}

    for idx, activity, score, type_match, _plan_day in candidates:
        if idx in used_items or activity.id in used_activities:
            continue
        used_items.add(idx)
        used_activities.add(activity.id)
        matches[idx] = (activity, score, type_match)

    annotated: list[dict[str, Any]] = []
    matched = missed = upcoming = planned_past = today_count = 0
    rest_ok = 0
    missed_titles: list[str] = []
    type_mismatch = 0

    for idx, item, plan_day in dated_items:
        st = item.get("session_type")
        is_rest = _is_rest_item(item)
        base = {
            "date": plan_day.isoformat(),
            "session_type": st,
            "session_type_label_fr": label_for(st) if st else None,
            "title": item.get("title"),
            "details": item.get("details"),
            "target_pace": item.get("target_pace"),
            "duration_or_distance": item.get("duration_or_distance"),
            "is_rest": is_rest,
        }
        # Futur strict : après aujourd'hui
        if plan_day > today:
            upcoming += 1
            annotated.append(
                {
                    **base,
                    "status": "upcoming",
                    "activity_id": None,
                    "confidence": None,
                    "type_match": None,
                    "rest_ok": None,
                }
            )
            continue

        # Jour en cours : pas encore « manqué » (la journée n’est pas close)
        if plan_day == today:
            today_count += 1
            if idx in matches:
                activity, score, type_match = matches[idx]
                if not type_match and st:
                    type_mismatch += 1
                conf = (
                    "haute"
                    if score >= 3 and type_match
                    else "moyenne"
                    if score >= 2
                    else "basse"
                )
                annotated.append(
                    {
                        **base,
                        "status": "today",
                        "activity_id": activity.id,
                        "activity_name": activity.name,
                        "confidence": conf,
                        "type_match": type_match,
                        "score": score,
                        "rest_ok": False,
                    }
                )
            else:
                annotated.append(
                    {
                        **base,
                        "status": "today",
                        "activity_id": None,
                        "confidence": None,
                        "type_match": None,
                        "rest_ok": is_rest or None,
                    }
                )
            continue

        # Jours complétés uniquement (≤ hier)
        planned_past += 1
        if idx in matches:
            activity, score, type_match = matches[idx]
            matched += 1
            hard = (activity.session_type or "") in HARD_SESSION_TYPES
            if is_rest and hard:
                type_mismatch += 1
                type_match = False
            elif not type_match and st and not is_rest:
                type_mismatch += 1
            conf = (
                "haute"
                if score >= 3 and type_match
                else "moyenne"
                if score >= 2
                else "basse"
            )
            annotated.append(
                {
                    **base,
                    "status": "matched",
                    "activity_id": activity.id,
                    "activity_name": activity.name,
                    "confidence": conf,
                    "type_match": type_match,
                    "score": score,
                    "rest_ok": False,
                }
            )
        elif is_rest:
            # Jour vide / repos respecté (aucune sortie requise)
            matched += 1
            rest_ok += 1
            annotated.append(
                {
                    **base,
                    "status": "matched",
                    "activity_id": None,
                    "confidence": "haute",
                    "type_match": True,
                    "rest_ok": True,
                }
            )
        else:
            missed += 1
            title = str(item.get("title") or "Séance")
            missed_titles.append(f"{plan_day.isoformat()} — {title}")
            annotated.append(
                {
                    **base,
                    "status": "missed",
                    "activity_id": None,
                    "confidence": None,
                    "type_match": None,
                    "rest_ok": False,
                }
            )

    adherence_pct = (
        round(100.0 * matched / planned_past, 1) if planned_past > 0 else None
    )

    warnings: list[str] = []
    if skipped:
        warnings.append(f"{skipped} item(s) sans date exclus du score.")
    if today_count:
        warnings.append(
            f"{today_count} séance(s) du jour en cours hors score (jours complétés = jusqu’à hier)."
        )

    return {
        "available": True,
        "adherence_pct": adherence_pct,
        "matched": matched,
        "missed": missed,
        "upcoming": upcoming,
        "today": today_count,
        "rest_ok": rest_ok,
        "planned_past": planned_past,
        "type_mismatch": type_mismatch,
        "items": annotated,
        "missed_titles": missed_titles[:10],
        "warnings_fr": warnings,
        "reason_fr": None,
        "plan_updated_at": plan_payload.get("updated_at"),
        "plan_summary": plan_payload.get("summary"),
    }

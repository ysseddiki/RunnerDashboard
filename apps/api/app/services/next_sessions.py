"""Prescriptions déterministes des prochaines séances (règles, pas LLM)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.services.activity_features import (
    ACR_HIGH_THRESHOLD,
    QUALITY_SESSION_TYPES,
    is_running_eligible,
)
from app.services.session_types import label_for

MIN_ACTIVITIES = 5
HARD_QUALITY = frozenset({"seuil", "vma", "fractionne"})
TARGET_COUNT_MIN = 3
TARGET_COUNT_MAX = 7
HORIZON_DAYS = 7

DEFAULT_DURATION: dict[str, str] = {
    "ef": "45–60 min",
    "recuperation": "30–40 min",
    "endurance_active": "50–70 min",
    "sortie_longue": "75–100 min",
    "tempo": "20–30 min travail + échauffement",
    "seuil": "3×8–10 min ou 20–25 min",
    "fractionne": "6–8×400–1000 m",
    "vma": "8–12×200–400 m",
    "fartlek": "40–55 min",
    "cotes": "6–10 côtes",
}


def _pace_map(training_paces: list[dict[str, Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for t in training_paces:
        st = t.get("session_type")
        pace = t.get("pace_sec_per_km")
        if st and pace is not None:
            out[str(st)] = float(pace)
    return out


def _days_since_type(rows: list[Any], st: str, now: datetime) -> int | None:
    dates = [
        a.start_date
        for a in rows
        if a.session_type == st and a.start_date and a.start_date <= now
    ]
    if not dates:
        return None
    last = max(dates)
    return max(0, (now.date() - last.astimezone(timezone.utc).date()).days)


def _quality_in_days(rows: list[Any], now: datetime, days: int) -> int:
    start = now - timedelta(days=days)
    return sum(
        1
        for a in rows
        if a.session_type in QUALITY_SESSION_TYPES
        and a.start_date
        and a.start_date >= start
    )


def _missed_quality_types(adherence: dict[str, Any] | None) -> list[str]:
    if not adherence or not adherence.get("available"):
        return []
    missed: list[str] = []
    for item in adherence.get("items") or []:
        if item.get("status") != "missed":
            continue
        st = item.get("session_type")
        if st in QUALITY_SESSION_TYPES and st not in missed:
            missed.append(str(st))
    return missed


def _pick_date(
    occupied: set[date], start: date, *, prefer: date | None = None, within: int = HORIZON_DAYS
) -> date:
    if prefer is not None and prefer not in occupied and 0 <= (prefer - start).days <= within:
        return prefer
    for i in range(within + 1):
        d = start + timedelta(days=i)
        if d not in occupied:
            return d
    return start + timedelta(days=within)


def _session_item(
    *,
    day: date,
    session_type: str,
    rationale_fr: str,
    paces: dict[str, float],
    title_fr: str | None = None,
) -> dict[str, Any]:
    label = label_for(session_type) or session_type
    pace = paces.get(session_type)
    return {
        "date": day.isoformat(),
        "session_type": session_type,
        "title_fr": title_fr or label,
        "duration_or_distance": DEFAULT_DURATION.get(session_type, "45–60 min"),
        "target_pace_sec_per_km": round(pace, 1) if pace is not None else None,
        "rationale_fr": rationale_fr,
        "source": "rules",
    }


def build_prescriptions(
    rows: list[Any],
    *,
    form: dict[str, Any],
    load: dict[str, Any],
    adherence: dict[str, Any] | None,
    training_paces: list[dict[str, Any]],
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    running = [a for a in rows if is_running_eligible(a) and a.start_date]

    if len(running) < MIN_ACTIVITIES:
        return {
            "available": False,
            "sessions": [],
            "reason_fr": (
                f"Seulement {len(running)} sortie(s) running "
                f"(minimum {MIN_ACTIVITIES}) pour prescrire."
            ),
        }

    paces = _pace_map(training_paces)
    status = form.get("status") if form.get("available") else None
    acr_high = bool(load.get("acr_elevated")) or (
        load.get("acr") is not None and float(load["acr"]) >= ACR_HIGH_THRESHOLD
    )
    fatigue = status == "fatigue" or acr_high

    today = now.astimezone(timezone.utc).date()
    start = today + timedelta(days=1)  # à partir de demain
    occupied: set[date] = set()
    sessions: list[dict[str, Any]] = []

    def add(st: str, rationale: str, prefer: date | None = None, title: str | None = None) -> None:
        if len(sessions) >= TARGET_COUNT_MAX:
            return
        day = _pick_date(occupied, start, prefer=prefer)
        occupied.add(day)
        sessions.append(
            _session_item(
                day=day,
                session_type=st,
                rationale_fr=rationale,
                paces=paces,
                title_fr=title,
            )
        )

    # a) Fatigue / ACR → récup / EF only early
    if fatigue:
        add(
            "recuperation",
            "Forme en fatigue ou ACR élevé : récupération prioritaire.",
            prefer=start,
        )
        add(
            "ef",
            "Volume facile pour digérer la charge.",
            prefer=start + timedelta(days=1),
        )
        add(
            "ef",
            "Maintenir le volume sans intensité forte.",
            prefer=start + timedelta(days=3),
        )
        # Optional easy active later if still room and not hard quality
        if status == "frais" or not acr_high:
            pass
        add(
            "endurance_active",
            "Réintroduction progressive d’une allure un peu plus soutenue.",
            prefer=start + timedelta(days=5),
        )
    else:
        # b) Missed quality
        missed_q = _missed_quality_types(adherence)
        if missed_q:
            st = missed_q[0]
            if st not in HARD_QUALITY or status in ("neutre", "productif", "frais", None):
                add(
                    st,
                    f"Séance qualité manquée au plan : reprogrammer un(e) {label_for(st) or st}.",
                    prefer=start + timedelta(days=1),
                )

        # c) No quality in 7d
        if _quality_in_days(running, now, 7) == 0 and status in (
            "neutre",
            "productif",
            "frais",
            None,
        ):
            # Prefer tempo then seuil
            preferred = "tempo" if "tempo" in paces or True else "seuil"
            if not any(s["session_type"] in QUALITY_SESSION_TYPES for s in sessions):
                add(
                    preferred,
                    "Aucune qualité sur 7 jours et forme ok : une séance tempo.",
                    prefer=start + timedelta(days=2),
                )

        # d) Long run
        days_long = _days_since_type(running, "sortie_longue", now)
        if days_long is None or days_long >= 10:
            add(
                "sortie_longue",
                "Pas de sortie longue récente (≥10 j) : volume endurance.",
                prefer=start + timedelta(days=5),
            )

        # e) Fill with easy
        while len(sessions) < 4:
            add(
                "ef",
                "Compléter la semaine en endurance fondamentale.",
            )

        # One more endurance_active if productive/fresh
        if status in ("productif", "frais") and len(sessions) < 6:
            if not any(s["session_type"] == "endurance_active" for s in sessions):
                add(
                    "endurance_active",
                    "Forme productive : une endurance active.",
                )

    # Safety: strip hard quality in first 3 calendar days if fatigue
    if fatigue:
        filtered: list[dict[str, Any]] = []
        for s in sessions:
            d = date.fromisoformat(s["date"])
            if (d - start).days <= 2 and s["session_type"] in HARD_QUALITY:
                continue
            filtered.append(s)
        sessions = filtered
        # Ensure at least one easy
        if not any(s["session_type"] in ("ef", "recuperation") for s in sessions):
            add("ef", "Séance facile de sécurité sous fatigue.")

    # Clamp count
    sessions = sorted(sessions, key=lambda s: s["date"])[:TARGET_COUNT_MAX]
    if len(sessions) < TARGET_COUNT_MIN and not fatigue:
        while len(sessions) < TARGET_COUNT_MIN:
            add("ef", "Séance EF pour atteindre un volume minimal.")
        sessions = sorted(sessions, key=lambda s: s["date"])[:TARGET_COUNT_MAX]

    notes: list[str] = []
    if not paces:
        notes.append(
            "Allures cibles limitées : taguez des séances ou consultez Prévisions."
        )
    tagged = sum(1 for a in running if a.session_type)
    if tagged < 3:
        notes.append("Peu de types tagués : les prescriptions sont plus génériques.")

    return {
        "available": True,
        "sessions": sessions,
        "horizon_days": HORIZON_DAYS,
        "form_status": status,
        "acr_elevated": acr_high,
        "notes_fr": notes,
        "reason_fr": None,
    }


def build_next_sessions(
    db: Any,
    user_id: int,
    *,
    now: datetime | None = None,
    preview_limit: int | None = None,
) -> dict[str, Any]:
    """Calcule next_sessions sans appeler build_overview (évite récursion)."""
    from sqlalchemy import select

    from app.models import Activity
    from app.services.analytics import _build_load
    from app.services.predictions import _estimate_for_rows, _training_paces
    from app.services.training_load import build_form_snapshot

    now = now or datetime.now(timezone.utc)
    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.user_id == user_id)
            .where(Activity.start_date.is_not(None))
            .order_by(Activity.start_date.asc())
        ).all()
    )
    running = [a for a in rows if is_running_eligible(a)]
    form = build_form_snapshot(db, user_id, now=now)
    load = _build_load(running, now)

    adherence: dict[str, Any] | None = None
    try:
        from app.services.plan_adherence import build_adherence

        adherence = build_adherence(db, user_id)
    except Exception:
        adherence = None

    training_paces: list[dict[str, Any]] = []
    core = _estimate_for_rows(running, as_of=now)
    if core is not None:
        pace_10 = next(
            (e["pace_sec_per_km"] for e in core["estimates"] if e["id"] == "10k"),
            None,
        )
        training_paces = _training_paces(running, pace_10, as_of=now)

    payload = build_prescriptions(
        rows,
        form=form,
        load=load,
        adherence=adherence,
        training_paces=training_paces,
        now=now,
    )
    if preview_limit is not None and payload.get("sessions"):
        payload = {
            **payload,
            "sessions": payload["sessions"][:preview_limit],
        }
    return payload

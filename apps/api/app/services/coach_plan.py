"""Plan calendrier coach persisté."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import CoachPlan
from app.services import athlete_profile as profile_service
from app.services import knowledge
from app.services import settings as settings_service
from app.services.coach import parse_coach_answer
from app.services.coach_context import build_coach_context
from app.services.ollama_client import OllamaClient, OllamaError

logger = logging.getLogger("coach.plan")

PLAN_SYSTEM = """Tu es un coach running francophone.
Tu génères UNIQUEMENT un plan calendrier JSON à partir du contexte et du pack knowledge.
Règles : n'invente aucun chrono absent du contexte ; suis plan-calendrier.md ; 3–7 séances sur 7–14 jours.
Réponds UNIQUEMENT avec JSON :
{"summary":"...","plan":[{"date":"YYYY-MM-DD","session_type":"ef","title":"...","details":"...","target_pace":"...","duration_or_distance":"..."}],"markdown":"## Notes\\n- ..."}
"""


def _get_row(db: Session) -> CoachPlan:
    row = db.get(CoachPlan, 1)
    if row is None:
        row = CoachPlan(id=1, status="empty", plan_json=[])
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_plan(db: Session) -> dict[str, Any]:
    row = _get_row(db)
    return {
        "status": row.status,
        "model": row.model,
        "summary": row.summary,
        "plan": row.plan_json or [],
        "markdown": row.markdown,
        "error": row.error,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def refresh_plan(db: Session, env: Settings, *, reason: str = "manual") -> dict[str, Any]:
    row = _get_row(db)
    row.status = "running"
    row.error = None
    db.commit()

    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    try:
        if not client.is_reachable():
            raise OllamaError("Ollama injoignable")
        if not client.model_installed(model):
            raise OllamaError(f"Modèle {model} non installé")

        context = build_coach_context(db, recent_limit=10)
        profile = profile_service.profile_payload(db)
        pack = knowledge.load_pack()
        user_message = (
            f"Raison refresh : {reason}\n\n"
            f"Pack knowledge :\n{pack}\n\n"
            f"Profil athlète :\n{json.dumps(profile, ensure_ascii=False)}\n\n"
            f"Contexte JSON :\n{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}\n\n"
            "Génère le plan calendrier JSON maintenant."
        )
        raw = client.chat(
            model=model,
            system=PLAN_SYSTEM,
            user=user_message,
            timeout_s=env.ollama_chat_timeout_s,
            num_predict=max(env.ollama_num_predict, 900),
            keep_alive=env.ollama_keep_alive,
        )
        parsed = parse_coach_answer(raw)
        row.model = model
        row.summary = parsed["summary"]
        row.plan_json = parsed["plan"]
        row.markdown = parsed["markdown"]
        row.status = "ready" if parsed["plan"] else "empty"
        row.error = None
        db.commit()
        logger.info(
            "Plan coach rafraîchi | reason=%s | model=%s | items=%s",
            reason,
            model,
            len(parsed["plan"]),
        )
    except Exception as exc:
        row.status = "error"
        row.error = str(exc)
        db.commit()
        logger.exception("Échec refresh plan | reason=%s", reason)
        raise

    return get_plan(db)

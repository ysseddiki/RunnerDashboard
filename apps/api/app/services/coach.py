"""Orchestration coach IA local (Ollama) — réponse structurée v2."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.services import settings as settings_service
from app.services.coach_context import build_coach_context
from app.services.ollama_client import OllamaClient, OllamaError
from app.services.session_types import SESSION_TYPE_IDS

logger = logging.getLogger("coach")

SYSTEM_PROMPT = """Tu es un coach running francophone, précis et prudent.
Tu travailles UNIQUEMENT avec le JSON de contexte fourni (prévisions d'allure, analytics, sorties).

Règles strictes :
- N'invente AUCUN chrono, allure, FC ou cadence absent du contexte.
- Corréle explicitement : prévisions (5/10/semi/marathon, allures d'entraînement) avec les sorties récentes.
- Signale les trous de données (cadence manquante, peu de tags, confiance basse).
- Réponds UNIQUEMENT avec un objet JSON valide (pas de texte avant/après, pas de fences markdown).

Schéma JSON imposé :
{
  "summary": "synthèse 2–4 phrases en français",
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "session_type": "un id parmi: ef, recuperation, endurance_active, sortie_longue, tempo, seuil, fractionne, vma, cotes, fartlek, competition, test, autre",
      "title": "titre court",
      "details": "consigne concrète",
      "target_pace": "ex. 5:20/km ou null",
      "duration_or_distance": "ex. 45 min ou 10 km"
    }
  ],
  "markdown": "analyse détaillée en markdown français (titres ##, listes) : corrélations, points d'attention, nuances"
}

Le plan couvre 7 à 14 jours (3 à 7 séances max). Dates cohérentes à partir d'aujourd'hui (contexte).
"""


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    chunk = text[start : end + 1]
    try:
        data = json.loads(chunk)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_plan_item(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    session_type = item.get("session_type")
    st = str(session_type).strip() if session_type is not None else ""
    if st and st not in SESSION_TYPE_IDS:
        st = "autre"
    date = item.get("date")
    title = item.get("title") or item.get("name") or "Séance"
    details = item.get("details") or item.get("description") or ""
    return {
        "date": str(date).strip() if date else None,
        "session_type": st or None,
        "title": str(title).strip()[:120],
        "details": str(details).strip()[:800],
        "target_pace": (
            str(item["target_pace"]).strip() if item.get("target_pace") not in (None, "") else None
        ),
        "duration_or_distance": (
            str(item["duration_or_distance"]).strip()
            if item.get("duration_or_distance") not in (None, "")
            else None
        ),
    }


def parse_coach_answer(raw: str) -> dict[str, Any]:
    """Parse la réponse modèle en summary / plan / markdown (+ answer legacy)."""
    data = _extract_json_object(raw)
    if data:
        summary = str(data.get("summary") or "").strip()
        markdown = str(data.get("markdown") or "").strip()
        plan_raw = data.get("plan")
        plan: list[dict[str, Any]] = []
        if isinstance(plan_raw, list):
            for item in plan_raw[:10]:
                normalized = _normalize_plan_item(item)
                if normalized:
                    plan.append(normalized)
        if not summary and markdown:
            summary = markdown.split("\n", 1)[0][:400]
        if not markdown:
            markdown = summary or raw.strip()
        if not summary:
            summary = "Conseil généré (voir détail ci-dessous)."
        answer = markdown if markdown else raw.strip()
        return {
            "summary": summary,
            "plan": plan,
            "markdown": markdown,
            "answer": answer,
            "structured": True,
        }

    text = (raw or "").strip()
    summary = text[:400] if text else "Réponse non structurée."
    return {
        "summary": summary,
        "plan": [],
        "markdown": text,
        "answer": text,
        "structured": False,
    }


def coach_status(db: Session, env: Settings) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    reachable = client.is_reachable()
    installed = False
    installed_models: list[str] = []
    error = None
    if reachable:
        try:
            installed_models = client.list_models()
            installed = client.model_installed(model)
        except OllamaError as exc:
            error = str(exc)
            reachable = False
    return {
        "reachable": reachable,
        "ollama_base_url": env.ollama_base_url,
        "model": model,
        "model_installed": installed,
        "installed_models": installed_models,
        "allowed_models": list(settings_service.ALLOWED_OLLAMA_MODELS),
        "chat_timeout_s": env.ollama_chat_timeout_s,
        "error": error,
        "ready": reachable and installed,
    }


def pull_configured_model(db: Session, env: Settings) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable():
        raise OllamaError("Ollama injoignable | action=vérifier_service_docker_ollama")
    client.pull_model(model)
    return {
        "model": model,
        "model_installed": client.model_installed(model),
        "message": f"Modèle {model} téléchargé (ou déjà présent).",
    }


def advise(db: Session, env: Settings, *, question: str | None = None) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable():
        raise OllamaError("Ollama injoignable | action=démarrer_service_ollama")
    if not client.model_installed(model):
        raise OllamaError(
            f"Modèle {model} non installé | action=Admin_télécharger_le_modèle_ou_pull_cli"
        )

    context = build_coach_context(db, recent_limit=8)
    question_text = (question or "").strip() or (
        "Analyse ma forme et mes prévisions d'allure. "
        "Corréle HR, types de séance et min/km avec les estimations. "
        "Propose un plan de séances pour les 10 prochains jours."
    )
    user_message = (
        "Question athlète :\n"
        f"{question_text}\n\n"
        "Contexte JSON (source de vérité) :\n"
        f"{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}"
    )

    raw = client.chat(
        model=model,
        system=SYSTEM_PROMPT,
        user=user_message,
        timeout_s=env.ollama_chat_timeout_s,
        num_predict=env.ollama_num_predict,
    )
    parsed = parse_coach_answer(raw)
    logger.info(
        "Conseil coach généré | model=%s | activities=%s | structured=%s | plan=%s | chars=%s",
        model,
        len(context.get("recent_activities") or []),
        parsed["structured"],
        len(parsed["plan"]),
        len(raw),
    )
    return {
        "model": model,
        "answer": parsed["answer"],
        "summary": parsed["summary"],
        "plan": parsed["plan"],
        "markdown": parsed["markdown"],
        "structured": parsed["structured"],
        "context_summary": {
            "predictions_available": bool((context.get("predictions") or {}).get("available")),
            "confidence": (context.get("predictions") or {}).get("confidence"),
            "analytics_category": (context.get("analytics") or {}).get("category"),
            "recent_activities": len(context.get("recent_activities") or []),
        },
    }

"""Orchestration coach IA local (Ollama)."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.services import settings as settings_service
from app.services.coach_context import build_coach_context
from app.services.ollama_client import OllamaClient, OllamaError

logger = logging.getLogger("coach")

SYSTEM_PROMPT = """Tu es un coach running francophone, précis et prudent.
Tu travailles UNIQUEMENT avec le JSON de contexte fourni (prévisions d'allure, analytics, sorties).
Règles strictes :
- Ne invente AUCUN chrono, allure, FC ou cadence absent du contexte.
- Corréle explicitement : prévisions (5/10/semi/marathon, allures d'entraînement) avec les sorties récentes (min/km, FC moy/max, type de séance, volume, météo).
- Signale les trous de données (cadence manquante, peu de tags, confiance basse).
- Réponds en français, structuré, concis (environ 250–450 mots).
Structure imposée :
1) Synthèse (2–4 phrases)
2) Corrélations prévisions ↔ terrain (FC, types d'allure, min/km)
3) Points d'attention
4) Plan court terme (3 à 5 actions concrètes pour 7–14 jours)
Pas de markdown trop lourd ; titres courts et listes à puces OK."""


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

    context = build_coach_context(db)
    question_text = (question or "").strip() or (
        "Analyse ma forme et mes prévisions d'allure. "
        "Corréle HR, types de séance et min/km avec les estimations."
    )
    user_payload = {
        "question": question_text,
        "contexte": context,
    }
    user_message = (
        "Question athlète :\n"
        f"{question_text}\n\n"
        "Contexte JSON (source de vérité) :\n"
        f"{json.dumps(user_payload['contexte'], ensure_ascii=False, separators=(',', ':'))}"
    )

    answer = client.chat(model=model, system=SYSTEM_PROMPT, user=user_message)
    logger.info(
        "Conseil coach généré | model=%s | activities=%s | answer_chars=%s",
        model,
        len(context.get("recent_activities") or []),
        len(answer),
    )
    return {
        "model": model,
        "answer": answer,
        "context_summary": {
            "predictions_available": bool((context.get("predictions") or {}).get("available")),
            "confidence": (context.get("predictions") or {}).get("confidence"),
            "analytics_category": (context.get("analytics") or {}).get("category"),
            "recent_activities": len(context.get("recent_activities") or []),
        },
    }

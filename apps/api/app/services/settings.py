"""Réglages applicatifs (modèle IA, etc.)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppSetting

OLLAMA_MODEL_KEY = "ollama_model"
ALLOWED_OLLAMA_MODELS = ("qwen2.5:7b", "qwen2.5:14b")


def get_ollama_model(db: Session, env: Settings) -> str:
    row = db.get(AppSetting, OLLAMA_MODEL_KEY)
    if row and row.value in ALLOWED_OLLAMA_MODELS:
        return row.value
    if env.ollama_model in ALLOWED_OLLAMA_MODELS:
        return env.ollama_model
    return "qwen2.5:14b"


def set_ollama_model(db: Session, model: str) -> str:
    if model not in ALLOWED_OLLAMA_MODELS:
        raise ValueError(
            f"Modèle non supporté: {model}. Choix: {', '.join(ALLOWED_OLLAMA_MODELS)}"
        )
    row = db.get(AppSetting, OLLAMA_MODEL_KEY)
    if row is None:
        row = AppSetting(key=OLLAMA_MODEL_KEY, value=model)
        db.add(row)
    else:
        row.value = model
    db.commit()
    db.refresh(row)
    return row.value

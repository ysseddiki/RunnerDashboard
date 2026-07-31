"""Réglages applicatifs (modèle IA, threads CPU, etc.)."""

from __future__ import annotations

import os
from typing import Literal

from sqlalchemy.orm import Session

from app.config import Settings, normalize_ollama_num_thread_raw, parse_ollama_num_thread
from app.models import AppSetting

OLLAMA_MODEL_KEY = "ollama_model"
OLLAMA_NUM_THREAD_KEY = "ollama_num_thread"
ALLOWED_OLLAMA_MODELS = ("qwen2.5:7b", "qwen2.5:14b")

Source = Literal["db", "env"]


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


def get_ollama_num_thread_raw(db: Session, env: Settings) -> tuple[str, Source]:
    row = db.get(AppSetting, OLLAMA_NUM_THREAD_KEY)
    if row and (row.value or "").strip():
        try:
            return normalize_ollama_num_thread_raw(row.value), "db"
        except ValueError:
            pass
    return normalize_ollama_num_thread_raw(env.ollama_num_thread or "auto"), "env"


def get_resolved_ollama_num_thread(db: Session, env: Settings) -> int | None:
    raw, _ = get_ollama_num_thread_raw(db, env)
    return parse_ollama_num_thread(raw)


def set_ollama_num_thread(db: Session, raw: str) -> str:
    value = normalize_ollama_num_thread_raw(raw)
    row = db.get(AppSetting, OLLAMA_NUM_THREAD_KEY)
    if row is None:
        row = AppSetting(key=OLLAMA_NUM_THREAD_KEY, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    db.refresh(row)
    return row.value


def build_settings_payload(db: Session, env: Settings) -> dict:
    model_row = db.get(AppSetting, OLLAMA_MODEL_KEY)
    model = get_ollama_model(db, env)
    model_source: Source = (
        "db"
        if model_row and model_row.value in ALLOWED_OLLAMA_MODELS
        else "env"
    )
    thread_raw, thread_source = get_ollama_num_thread_raw(db, env)
    return {
        "ollama_model": model,
        "allowed_ollama_models": list(ALLOWED_OLLAMA_MODELS),
        "ollama_model_source": model_source,
        "ollama_num_thread": thread_raw,
        "ollama_num_thread_effective": get_resolved_ollama_num_thread(db, env),
        "ollama_num_thread_source": thread_source,
        "cpu_count": os.cpu_count() or 1,
    }

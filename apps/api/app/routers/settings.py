"""API paramètres applicatifs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.services import settings as settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class AppSettingsResponse(BaseModel):
    ollama_model: str
    allowed_ollama_models: list[str]
    ollama_model_source: str = Field(
        description="db si réglage UI, sinon env"
    )


class AppSettingsUpdate(BaseModel):
    ollama_model: str


@router.get("", response_model=AppSettingsResponse)
def get_app_settings(
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> AppSettingsResponse:
    from app.models import AppSetting

    row = db.get(AppSetting, settings_service.OLLAMA_MODEL_KEY)
    model = settings_service.get_ollama_model(db, env)
    source = (
        "db"
        if row and row.value in settings_service.ALLOWED_OLLAMA_MODELS
        else "env"
    )
    return AppSettingsResponse(
        ollama_model=model,
        allowed_ollama_models=list(settings_service.ALLOWED_OLLAMA_MODELS),
        ollama_model_source=source,
    )


@router.put("", response_model=AppSettingsResponse)
def update_app_settings(
    body: AppSettingsUpdate,
    db: Session = Depends(get_db),
    _env: Settings = Depends(get_settings),
) -> AppSettingsResponse:
    try:
        model = settings_service.set_ollama_model(db, body.ollama_model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AppSettingsResponse(
        ollama_model=model,
        allowed_ollama_models=list(settings_service.ALLOWED_OLLAMA_MODELS),
        ollama_model_source="db",
    )

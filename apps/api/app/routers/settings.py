"""API paramètres — lecture publique auth ; écriture déplacée sous /api/admin/settings."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.services import settings as settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class AppSettingsResponse(BaseModel):
    ollama_model: str
    allowed_ollama_models: list[str]
    ollama_model_source: str = Field(
        description="db si réglage UI, sinon env"
    )


@router.get("", response_model=AppSettingsResponse)
def get_app_settings(
    _user: User = Depends(auth_service.require_user),
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

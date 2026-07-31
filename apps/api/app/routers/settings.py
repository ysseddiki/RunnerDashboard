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
    ollama_model_source: str = Field(description="db si réglage UI, sinon env")
    ollama_num_thread: str = "auto"
    ollama_num_thread_effective: int | None = None
    ollama_num_thread_source: str = "env"
    cpu_count: int = 1


@router.get("", response_model=AppSettingsResponse)
def get_app_settings(
    _user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> AppSettingsResponse:
    return AppSettingsResponse(**settings_service.build_settings_payload(db, env))

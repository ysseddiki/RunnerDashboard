"""API coach IA local."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.services import coach as coach_service
from app.services.ollama_client import OllamaError

router = APIRouter(prefix="/api/coach", tags=["coach"])


class CoachStatusResponse(BaseModel):
    reachable: bool
    ollama_base_url: str
    model: str
    model_installed: bool
    installed_models: list[str]
    allowed_models: list[str]
    chat_timeout_s: float = 600.0
    error: str | None = None
    ready: bool


class CoachPullResponse(BaseModel):
    model: str
    model_installed: bool
    message: str


class CoachAdviseRequest(BaseModel):
    question: str | None = Field(
        default=None,
        description="Question libre optionnelle (FR)",
        max_length=2000,
    )


class CoachAdviseResponse(BaseModel):
    model: str
    answer: str
    context_summary: dict


@router.get("/status", response_model=CoachStatusResponse)
def coach_status(
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachStatusResponse:
    return CoachStatusResponse.model_validate(coach_service.coach_status(db, env))


@router.post("/pull-model", response_model=CoachPullResponse)
def pull_model(
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachPullResponse:
    try:
        result = coach_service.pull_configured_model(db, env)
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return CoachPullResponse.model_validate(result)


@router.post("/advise", response_model=CoachAdviseResponse)
def advise(
    body: CoachAdviseRequest | None = None,
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachAdviseResponse:
    question = body.question if body else None
    try:
        result = coach_service.advise(db, env, question=question)
    except OllamaError as exc:
        detail = str(exc).lower()
        if "timeout" in detail:
            status = 504
        elif "injoignable" in detail:
            status = 503
        else:
            status = 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return CoachAdviseResponse.model_validate(result)

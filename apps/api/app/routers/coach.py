"""API coach IA local."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.services import activity_coach as activity_coach_service
from app.services import coach as coach_service
from app.services import coach_jobs
from app.services import coach_plan as coach_plan_service
from app.services.ollama_client import OllamaError

router = APIRouter(prefix="/api/coach", tags=["coach"])


class CoachStatusResponse(BaseModel):
    reachable: bool
    ollama_base_url: str
    model: str
    model_installed: bool
    model_loaded: bool = False
    installed_models: list[str]
    allowed_models: list[str]
    chat_timeout_s: float = 600.0
    error: str | None = None
    ready: bool


class CoachPullResponse(BaseModel):
    model: str
    model_installed: bool
    message: str


class CoachWarmupResponse(BaseModel):
    model: str
    loaded: bool
    already_loaded: bool = False
    message: str


class CoachAdviseRequest(BaseModel):
    question: str | None = Field(
        default=None,
        description="Question libre optionnelle (FR)",
        max_length=2000,
    )


class CoachPlanItem(BaseModel):
    date: str | None = None
    session_type: str | None = None
    title: str
    details: str = ""
    target_pace: str | None = None
    duration_or_distance: str | None = None


class CoachAdviseResponse(BaseModel):
    model: str
    answer: str
    summary: str
    plan: list[CoachPlanItem] = []
    markdown: str
    structured: bool = False
    context_summary: dict


@router.get("/status", response_model=CoachStatusResponse)
def coach_status(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachStatusResponse:
    return CoachStatusResponse.model_validate(coach_service.coach_status(db, env))


@router.post("/pull-model", response_model=CoachPullResponse)
def pull_model(
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachPullResponse:
    try:
        result = coach_service.pull_configured_model(db, env)
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return CoachPullResponse.model_validate(result)


@router.post("/warmup", response_model=CoachWarmupResponse)
def warmup_model(
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachWarmupResponse:
    try:
        result = coach_service.warmup_configured_model(db, env)
    except OllamaError as exc:
        detail = str(exc).lower()
        status = 504 if "timeout" in detail else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return CoachWarmupResponse.model_validate(result)


@router.post("/advise", response_model=CoachAdviseResponse)
def advise(
    body: CoachAdviseRequest | None = None,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> CoachAdviseResponse:
    question = body.question if body else None
    try:
        result = coach_service.advise(db, env, user.id, question=question)
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


@router.get("/plan")
def get_plan(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return coach_plan_service.get_plan(db, user.id)


@router.post("/plan/refresh")
def refresh_plan(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
    background: bool = Query(default=True),
) -> dict:
    if background:
        started = coach_jobs.schedule_plan_refresh(user_id=user.id, reason="api")
        return {
            "scheduled": started,
            "message": "Refresh plan démarré en arrière-plan."
            if started
            else "Refresh déjà en cours.",
            "plan": coach_plan_service.get_plan(db, user.id),
        }
    try:
        plan = coach_plan_service.refresh_plan(db, env, user.id, reason="api-sync")
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"scheduled": False, "message": "Plan rafraîchi.", "plan": plan}


@router.post("/activities/{activity_id}/analyze")
def analyze_one(
    activity_id: int,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> dict:
    try:
        return activity_coach_service.analyze_activity(db, env, user.id, activity_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

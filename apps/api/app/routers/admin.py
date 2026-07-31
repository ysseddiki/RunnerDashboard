"""API administration (users, settings, resets)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import Activity, User
from app.services import settings as settings_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class AppSettingsResponse(BaseModel):
    ollama_model: str
    allowed_ollama_models: list[str]
    ollama_model_source: str
    ollama_num_thread: str = "auto"
    ollama_num_thread_effective: int | None = None
    ollama_num_thread_source: str = "env"
    cpu_count: int = 1


class AppSettingsUpdate(BaseModel):
    ollama_model: str | None = None
    ollama_num_thread: str | None = None


class ClearSessionTypesResult(BaseModel):
    cleared: int
    message: str


@router.get("/users")
def list_users(
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = db.scalars(select(User).order_by(User.created_at.asc())).all()
    return [auth_service.user_public_dict(u) for u in rows]


@router.patch("/users/{user_id}")
def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
) -> dict:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    new_role = body.role
    if target.role == auth_service.ROLE_ADMIN and new_role == auth_service.ROLE_USER:
        if auth_service.count_admins(db) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Impossible de retirer le dernier administrateur",
            )
        if target.id == admin.id:
            raise HTTPException(
                status_code=400,
                detail="Impossible de vous retirer le rôle admin (demandez à un autre admin)",
            )

    target.role = new_role
    db.commit()
    db.refresh(target)
    return auth_service.user_public_dict(target)


@router.get("/settings", response_model=AppSettingsResponse)
def get_admin_settings(
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> AppSettingsResponse:
    return AppSettingsResponse(**settings_service.build_settings_payload(db, env))


@router.put("/settings", response_model=AppSettingsResponse)
def update_admin_settings(
    body: AppSettingsUpdate,
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> AppSettingsResponse:
    if body.ollama_model is None and body.ollama_num_thread is None:
        raise HTTPException(
            status_code=400,
            detail="Indiquez ollama_model et/ou ollama_num_thread.",
        )
    try:
        if body.ollama_model is not None:
            settings_service.set_ollama_model(db, body.ollama_model)
        if body.ollama_num_thread is not None:
            settings_service.set_ollama_num_thread(db, body.ollama_num_thread)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AppSettingsResponse(**settings_service.build_settings_payload(db, env))


@router.post("/users/{user_id}/clear-session-types", response_model=ClearSessionTypesResult)
def clear_user_session_types(
    user_id: int,
    _admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
) -> ClearSessionTypesResult:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    result = db.execute(
        update(Activity)
        .where(Activity.user_id == user_id, Activity.session_type.is_not(None))
        .values(session_type=None)
    )
    cleared = result.rowcount or 0
    db.commit()
    message = (
        f"Types de séance effacés : {cleared} activité(s) pour l’utilisateur #{user_id}."
        if cleared
        else "Aucun type de séance à effacer pour cet utilisateur."
    )
    return ClearSessionTypesResult(cleared=cleared, message=message)


@router.post("/me/clear-session-types", response_model=ClearSessionTypesResult)
def clear_own_session_types(
    admin: User = Depends(auth_service.require_admin),
    db: Session = Depends(get_db),
) -> ClearSessionTypesResult:
    result = db.execute(
        update(Activity)
        .where(Activity.user_id == admin.id, Activity.session_type.is_not(None))
        .values(session_type=None)
    )
    cleared = result.rowcount or 0
    db.commit()
    message = (
        f"Types de séance effacés : {cleared} activité(s)."
        if cleared
        else "Aucun type de séance à effacer."
    )
    return ClearSessionTypesResult(cleared=cleared, message=message)

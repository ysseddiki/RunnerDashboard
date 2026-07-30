"""API projections d’évolution."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.db import get_db
from app.models import User
from app.services import projections as projections_service

router = APIRouter(prefix="/api/projections", tags=["projections"])


@router.get("/overview")
def projections_overview(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return projections_service.build_projection(db, user.id)

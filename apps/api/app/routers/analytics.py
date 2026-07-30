"""Routes analytics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.db import get_db
from app.models import User
from app.services.analytics import build_overview
from app.services.training_load import DEFAULT_SERIES_DAYS, build_series

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def analytics_overview(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return build_overview(db, user.id)


@router.get("/load-series")
def analytics_load_series(
    days: int = Query(DEFAULT_SERIES_DAYS, ge=14, le=365),
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return build_series(db, user.id, days=days)

"""Routes analytics."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.db import get_db
from app.models import Activity, AthleteProfile, User
from app.services.analytics import build_overview
from app.services.next_sessions import build_next_sessions
from app.services.session_type_trends import DEFAULT_DAYS as TRENDS_DEFAULT_DAYS
from app.services.session_type_trends import build_trends
from app.services.training_load import DEFAULT_SERIES_DAYS, build_series

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class DataRevisionResponse(BaseModel):
    revision: str
    activities_count: int
    last_activity_synced_at: datetime | None = None
    profile_updated_at: datetime | None = None


@router.get("/data-revision", response_model=DataRevisionResponse)
def data_revision(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> DataRevisionResponse:
    """Empreinte légère des données métier pour cache client (prévisions, etc.)."""
    count = db.scalar(
        select(func.count()).select_from(Activity).where(Activity.user_id == user.id)
    ) or 0
    last_synced = db.scalar(
        select(func.max(Activity.synced_at)).where(Activity.user_id == user.id)
    )
    profile = db.get(AthleteProfile, user.id)
    profile_updated = profile.updated_at if profile else None
    parts = [
        str(count),
        last_synced.isoformat() if last_synced is not None else "none",
        profile_updated.isoformat() if profile_updated is not None else "none",
    ]
    return DataRevisionResponse(
        revision="|".join(parts),
        activities_count=int(count),
        last_activity_synced_at=last_synced,
        profile_updated_at=profile_updated,
    )


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


@router.get("/session-type-trends")
def analytics_session_type_trends(
    days: int = Query(TRENDS_DEFAULT_DAYS, ge=28, le=365),
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return build_trends(db, user.id, days=days)


@router.get("/next-sessions")
def analytics_next_sessions(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return build_next_sessions(db, user.id)

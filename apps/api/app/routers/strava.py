"""Routes Strava sync (OAuth déplacé vers /api/auth/strava)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.schemas import StravaStatus, SyncResult
from app.services import sync as sync_service
from app.services.strava_client import StravaError

logger = logging.getLogger("sync.strava")
router = APIRouter(prefix="/api/strava", tags=["strava"])


@router.get("/status", response_model=StravaStatus)
def strava_status(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> StravaStatus:
    token = sync_service.get_token(db, user.id)
    if token is None:
        return StravaStatus(connected=False)
    name = " ".join(
        part for part in [token.athlete_firstname, token.athlete_lastname] if part
    ).strip() or None
    return StravaStatus(
        connected=True,
        athlete_id=token.athlete_id,
        athlete_name=name,
        expires_at=token.expires_at,
    )


@router.post("/sync", response_model=SyncResult)
def sync_strava(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SyncResult:
    try:
        result = sync_service.sync_activities(db, settings, user.id)
    except StravaError as exc:
        status = 401 if "connecté" in str(exc).lower() or "token" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return SyncResult(**result)

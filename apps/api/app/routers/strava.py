"""Routes Strava OAuth + sync."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.schemas import AuthUrlResponse, StravaStatus, SyncResult
from app.services import sync as sync_service
from app.services.strava_client import StravaClient, StravaError

logger = logging.getLogger("sync.strava")
router = APIRouter(prefix="/api/strava", tags=["strava"])


@router.get("/status", response_model=StravaStatus)
def strava_status(db: Session = Depends(get_db)) -> StravaStatus:
    token = sync_service.get_token(db)
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


@router.get("/auth-url", response_model=AuthUrlResponse)
def auth_url(settings: Settings = Depends(get_settings)) -> AuthUrlResponse:
    client = StravaClient(settings)
    try:
        return AuthUrlResponse(url=client.build_authorize_url())
    except StravaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/callback")
def oauth_callback(
    code: str | None = None,
    scope: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    frontend = settings.public_app_url.rstrip("/")
    if error:
        logger.error("OAuth Strava refusé | error=%s | action=réessayer_connexion", error)
        return RedirectResponse(f"{frontend}/?strava=error&reason={error}")
    if not code:
        return RedirectResponse(f"{frontend}/?strava=error&reason=missing_code")

    client = StravaClient(settings)
    try:
        payload = client.exchange_code(code)
        sync_service.upsert_token_from_oauth(db, payload, scope)
    except StravaError as exc:
        logger.error("OAuth callback échoué | detail=%s", str(exc))
        return RedirectResponse(f"{frontend}/?strava=error&reason=token_exchange")

    return RedirectResponse(f"{frontend}/?strava=connected")


@router.post("/sync", response_model=SyncResult)
def sync_strava(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SyncResult:
    try:
        result = sync_service.sync_activities(db, settings)
    except StravaError as exc:
        status = 401 if "connecté" in str(exc).lower() or "token" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return SyncResult(**result)

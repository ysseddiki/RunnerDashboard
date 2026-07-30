"""Auth Strava OAuth + session cookie."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import StravaToken, User
from app.services.strava_client import StravaClient, StravaError

logger = logging.getLogger("auth.strava")
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
def me(user: User = Depends(auth_service.require_user)) -> dict:
    return auth_service.user_public_dict(user)


@router.post("/logout")
def logout(
    response: Response,
    settings: Settings = Depends(get_settings),
) -> dict:
    auth_service.clear_session_cookie(response, settings)
    return {"ok": True}


@router.get("/strava/login")
def strava_login(
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    client = StravaClient(settings)
    try:
        state = auth_service.create_oauth_state(settings)
        url = client.build_authorize_url(state=state)
    except StravaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = RedirectResponse(url, status_code=302)
    auth_service.set_oauth_state_cookie(response, settings, state)
    return response


@router.get("/strava/callback")
def strava_callback(
    request: Request,
    code: str | None = None,
    scope: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    frontend = settings.public_app_url.rstrip("/")
    cookie_state = request.cookies.get("rd_oauth_state")

    def fail(reason: str) -> RedirectResponse:
        resp = RedirectResponse(f"{frontend}/login?error={reason}", status_code=302)
        auth_service.clear_oauth_state_cookie(resp, settings)
        return resp

    if error:
        logger.error("OAuth Strava refusé | error=%s", error)
        return fail(error)
    if not code:
        return fail("missing_code")
    if not state or not cookie_state or state != cookie_state:
        return fail("invalid_state")
    if not auth_service.verify_oauth_state(settings, state):
        return fail("expired_state")

    client = StravaClient(settings)
    try:
        payload = client.exchange_code(code)
    except StravaError as exc:
        logger.error("OAuth callback échoué | detail=%s", str(exc))
        return fail("token_exchange")

    athlete = payload.get("athlete") or {}
    athlete_id = int(athlete["id"])
    firstname = athlete.get("firstname")
    lastname = athlete.get("lastname")
    now = datetime.now(timezone.utc)

    user = db.scalar(select(User).where(User.strava_athlete_id == athlete_id))
    if user is None:
        role = (
            auth_service.ROLE_ADMIN
            if auth_service.count_admins(db) == 0
            else auth_service.ROLE_USER
        )
        user = User(
            strava_athlete_id=athlete_id,
            firstname=firstname,
            lastname=lastname,
            role=role,
            last_login_at=now,
        )
        db.add(user)
        db.flush()
        logger.info(
            "Nouvel utilisateur | user_id=%s | athlete_id=%s | role=%s",
            user.id,
            athlete_id,
            role,
        )
    else:
        user.firstname = firstname
        user.lastname = lastname
        user.last_login_at = now

    token = db.scalar(select(StravaToken).where(StravaToken.user_id == user.id))
    if token is None:
        token = db.scalar(select(StravaToken).where(StravaToken.athlete_id == athlete_id))
    if token is None:
        token = StravaToken(user_id=user.id, athlete_id=athlete_id)
    token.user_id = user.id
    token.athlete_id = athlete_id
    token.access_token = payload["access_token"]
    token.refresh_token = payload["refresh_token"]
    token.expires_at = int(payload["expires_at"])
    token.athlete_firstname = firstname
    token.athlete_lastname = lastname
    token.scope = scope
    db.add(token)
    db.commit()
    db.refresh(user)

    response = RedirectResponse(f"{frontend}/", status_code=302)
    auth_service.set_session_cookie(response, settings, user.id)
    auth_service.clear_oauth_state_cookie(response, settings)
    logger.info("Session créée | user_id=%s | athlete_id=%s", user.id, athlete_id)
    return response

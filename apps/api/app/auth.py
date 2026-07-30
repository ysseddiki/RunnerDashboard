"""Sessions cookie signées + dépendances auth."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import User

ROLE_USER = "user"
ROLE_ADMIN = "admin"


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="rd-session-v1")


def _oauth_serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="rd-oauth-state-v1")


def create_session_token(settings: Settings, user_id: int) -> str:
    return _serializer(settings).dumps({"uid": user_id})


def read_session_token(settings: Settings, token: str) -> int | None:
    try:
        data = _serializer(settings).loads(token, max_age=settings.session_max_age_s)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid")
    return int(uid) if uid is not None else None


def create_oauth_state(settings: Settings) -> str:
    import secrets

    return _oauth_serializer(settings).dumps({"n": secrets.token_urlsafe(16)})


def verify_oauth_state(settings: Settings, state: str, max_age: int = 600) -> bool:
    try:
        _oauth_serializer(settings).loads(state, max_age=max_age)
        return True
    except (BadSignature, SignatureExpired):
        return False


def set_session_cookie(response: Response, settings: Settings, user_id: int) -> None:
    token = create_session_token(settings, user_id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_s,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        samesite="lax",
        secure=settings.session_cookie_secure,
    )


def set_oauth_state_cookie(response: Response, settings: Settings, state: str) -> None:
    response.set_cookie(
        key="rd_oauth_state",
        value=state,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


def clear_oauth_state_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key="rd_oauth_state",
        path="/",
        samesite="lax",
        secure=settings.session_cookie_secure,
    )


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User | None:
    raw = request.cookies.get(settings.session_cookie_name)
    if not raw:
        return None
    user_id = read_session_token(settings, raw)
    if user_id is None:
        return None
    return db.get(User, user_id)


def require_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentification requise")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user


def count_admins(db: Session) -> int:
    return int(
        db.scalar(select(func.count()).select_from(User).where(User.role == ROLE_ADMIN))
        or 0
    )


def user_public_dict(user: User) -> dict:
    name = " ".join(
        part for part in [user.firstname, user.lastname] if part
    ).strip() or None
    return {
        "id": user.id,
        "strava_athlete_id": user.strava_athlete_id,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "display_name": name,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }

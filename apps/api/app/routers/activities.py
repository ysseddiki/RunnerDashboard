"""Routes activités."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.config import Settings, get_settings
from app.db import get_db
from app.models import Activity, User
from app.services import session_type_suggest as suggest_service
from app.services import sync as sync_service
from app.services.session_types import SESSION_TYPES
from app.services.strava_client import StravaError
from app.services.terrains import TERRAINS
from app.schemas import (
    ActivityDetail,
    ActivityUpdate,
    ActivitySummary,
    CadenceRecomputeResult,
    SessionTypeInfo,
    TerrainInfo,
)

router = APIRouter(prefix="/api/activities", tags=["activities"])


class SessionTypeSuggestRequest(BaseModel):
    use_ai: bool = False


class SessionTypeSuggestBatchRequest(BaseModel):
    use_ai: bool = False
    untagged_only: bool = True
    limit: int = Field(default=50, ge=1, le=100)
    activity_ids: list[int] | None = None
    min_confidence: str = Field(default="basse", pattern="^(haute|moyenne|basse)$")


class SessionTypeSuggestResponse(BaseModel):
    activity_id: int
    current_session_type: str | None = None
    suggested_session_type: str
    confidence: str
    source: str
    rationale_fr: str
    label_fr: str | None = None


class SessionTypeSuggestBatchResponse(BaseModel):
    count: int
    suggestions: list[dict]


class ApplySuggestionsRequest(BaseModel):
    use_ai: bool = False
    untagged_only: bool = True
    limit: int = Field(default=50, ge=1, le=100)
    activity_ids: list[int] | None = None
    min_confidence: str = Field(default="basse", pattern="^(haute|moyenne|basse)$")


class BulkUpdateRequest(BaseModel):
    activity_ids: list[int] = Field(..., min_length=1, max_length=200)
    session_type: str | None = None
    terrain: str | None = None
    clear_session_type: bool = False
    clear_terrain: bool = False


class ClearSessionTypesResult(BaseModel):
    cleared: int
    message: str


def _owned_activity(db: Session, user_id: int, activity_id: int) -> Activity:
    row = db.get(Activity, activity_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    return row


@router.get("/session-types", response_model=list[SessionTypeInfo])
def list_session_types() -> list[SessionTypeInfo]:
    return [SessionTypeInfo(**item) for item in SESSION_TYPES]


@router.get("/terrains", response_model=list[TerrainInfo])
def list_terrains() -> list[TerrainInfo]:
    return [TerrainInfo(**item) for item in TERRAINS]


@router.post("/clear-session-types", response_model=ClearSessionTypesResult)
def clear_session_types(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> ClearSessionTypesResult:
    result = db.execute(
        update(Activity)
        .where(Activity.user_id == user.id, Activity.session_type.is_not(None))
        .values(session_type=None)
    )
    cleared = result.rowcount or 0
    db.commit()
    message = (
        f"Types de séance effacés : {cleared} activité(s) repassée(s) en non classé."
        if cleared
        else "Aucun type de séance à effacer."
    )
    return ClearSessionTypesResult(cleared=cleared, message=message)


@router.post("/suggest-session-types", response_model=SessionTypeSuggestBatchResponse)
def suggest_session_types_batch(
    body: SessionTypeSuggestBatchRequest | None = None,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> SessionTypeSuggestBatchResponse:
    req = body or SessionTypeSuggestBatchRequest()
    result = suggest_service.suggest_batch(
        db,
        user.id,
        env=env,
        use_ai=req.use_ai,
        untagged_only=req.untagged_only,
        limit=req.limit,
        activity_ids=req.activity_ids,
    )
    return SessionTypeSuggestBatchResponse.model_validate(result)


@router.post("/apply-session-type-suggestions")
def apply_session_type_suggestions(
    body: ApplySuggestionsRequest | None = None,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> dict:
    req = body or ApplySuggestionsRequest()
    conf = req.min_confidence
    if conf not in ("haute", "moyenne", "basse"):
        conf = "basse"
    return suggest_service.apply_suggestions(
        db,
        user.id,
        env=env,
        use_ai=req.use_ai,
        untagged_only=req.untagged_only,
        limit=req.limit,
        min_confidence=conf,  # type: ignore[arg-type]
        activity_ids=req.activity_ids,
    )


@router.post("/bulk-update")
def bulk_update_activities(
    body: BulkUpdateRequest,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return suggest_service.bulk_update(
            db,
            user.id,
            body.activity_ids,
            session_type=body.session_type,
            terrain=body.terrain,
            clear_session_type=body.clear_session_type,
            clear_terrain=body.clear_terrain,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/recompute-cadence", response_model=CadenceRecomputeResult)
def recompute_cadence(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> CadenceRecomputeResult:
    stats = sync_service.recompute_cadence_from_local(db, user.id)
    message = (
        f"Cadence locale : {stats['updated']} mise(s) à jour, "
        f"{stats['unchanged']} inchangée(s), {stats['still_missing']} sans cadence. "
        f"Sources en base — streams: {stats['with_streams']}, "
        f"stream cadence: {stats['with_cadence_stream']}, "
        f"average_cadence: {stats['with_average_cadence']}, "
        f"laps: {stats['with_laps_cadence']}."
    )
    return CadenceRecomputeResult(**stats, message=message)


@router.post("/refresh-cadence-strava", response_model=CadenceRecomputeResult)
def refresh_cadence_strava(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    max_activities: int = Query(25, ge=1, le=50),
) -> CadenceRecomputeResult:
    try:
        stats = sync_service.refresh_cadence_from_strava(
            db, settings, user.id, max_activities=max_activities
        )
    except StravaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    message = (
        f"Refresh Strava cadence : {stats['fetched']} rechargée(s), "
        f"{stats['updated']} avec cadence, {stats['still_missing']} toujours vide, "
        f"{stats['errors']} erreur(s), {stats['remaining']} restante(s) "
        f"(relancer si besoin — Apple Forme n’envoie souvent pas la cadence à Strava)."
    )
    return CadenceRecomputeResult(
        updated=stats["updated"],
        still_missing=stats["still_missing"],
        fetched=stats["fetched"],
        errors=stats["errors"],
        remaining=stats["remaining"],
        message=message,
    )


@router.post("/recompute-features")
def recompute_features(
    force: bool = Query(False),
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.services import activity_features as features_service

    stats = features_service.recompute_features_batch(db, user.id, force=force)
    message = (
        f"Features recalculées : {stats['updated']} mise(s) à jour, "
        f"{stats['skipped']} inchangée(s), {stats['errors']} erreur(s) "
        f"sur {stats['total']} activité(s)."
    )
    return {**stats, "message": message}


@router.get("", response_model=list[ActivitySummary])
def list_activities(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> list[Activity]:
    stmt = (
        select(Activity)
        .where(Activity.user_id == user.id)
        .order_by(Activity.start_date.desc().nullslast())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


@router.get("/{activity_id}", response_model=ActivityDetail)
def get_activity(
    activity_id: int,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> Activity:
    return _owned_activity(db, user.id, activity_id)


@router.post(
    "/{activity_id}/suggest-session-type",
    response_model=SessionTypeSuggestResponse,
)
def suggest_session_type(
    activity_id: int,
    body: SessionTypeSuggestRequest | None = None,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
    env: Settings = Depends(get_settings),
) -> SessionTypeSuggestResponse:
    row = _owned_activity(db, user.id, activity_id)
    use_ai = body.use_ai if body else False
    result = suggest_service.suggest_for_activity(
        db, user.id, row, env=env, use_ai=use_ai
    )
    return SessionTypeSuggestResponse.model_validate(result)


@router.patch("/{activity_id}", response_model=ActivityDetail)
def patch_activity(
    activity_id: int,
    body: ActivityUpdate,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> Activity:
    row = _owned_activity(db, user.id, activity_id)

    payload = body.model_dump(exclude_unset=True)
    session_changed = False
    if "session_type" in payload:
        row.session_type = payload["session_type"]
        session_changed = True
    if "terrain" in payload:
        row.terrain = payload["terrain"]
    if payload.get("clear_cadence"):
        row.cadence_ppm = None
    elif "cadence_ppm" in payload and payload["cadence_ppm"] is not None:
        row.cadence_ppm = payload["cadence_ppm"]

    if session_changed or "terrain" in payload:
        from app.services import activity_features as features_service

        features_service.apply_features(db, row, force=True)

    db.commit()
    db.refresh(row)
    return row

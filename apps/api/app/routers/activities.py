"""Routes activités."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import Activity
from app.schemas import (
    ActivityDetail,
    ActivityUpdate,
    ActivitySummary,
    CadenceRecomputeResult,
    SessionTypeInfo,
)
from app.services import sync as sync_service
from app.services.session_types import SESSION_TYPES
from app.services.strava_client import StravaError

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("/session-types", response_model=list[SessionTypeInfo])
def list_session_types() -> list[SessionTypeInfo]:
    return [SessionTypeInfo(**item) for item in SESSION_TYPES]


@router.post("/recompute-cadence", response_model=CadenceRecomputeResult)
def recompute_cadence(db: Session = Depends(get_db)) -> CadenceRecomputeResult:
    stats = sync_service.recompute_cadence_from_local(db)
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
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    max_activities: int = Query(25, ge=1, le=50),
) -> CadenceRecomputeResult:
    try:
        stats = sync_service.refresh_cadence_from_strava(
            db, settings, max_activities=max_activities
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


@router.get("", response_model=list[ActivitySummary])
def list_activities(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Activity]:
    stmt = (
        select(Activity)
        .order_by(Activity.start_date.desc().nullslast())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


@router.get("/{activity_id}", response_model=ActivityDetail)
def get_activity(activity_id: int, db: Session = Depends(get_db)) -> Activity:
    row = db.get(Activity, activity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    return row


@router.patch("/{activity_id}", response_model=ActivityDetail)
def patch_activity(
    activity_id: int,
    body: ActivityUpdate,
    db: Session = Depends(get_db),
) -> Activity:
    row = db.get(Activity, activity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Activité introuvable")

    payload = body.model_dump(exclude_unset=True)
    if "session_type" in payload:
        row.session_type = payload["session_type"]
    if payload.get("clear_cadence"):
        row.cadence_ppm = None
    elif "cadence_ppm" in payload and payload["cadence_ppm"] is not None:
        row.cadence_ppm = payload["cadence_ppm"]

    db.commit()
    db.refresh(row)
    return row

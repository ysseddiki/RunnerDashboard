"""Routes activités."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Activity
from app.schemas import (
    ActivityDetail,
    ActivitySessionTypeUpdate,
    ActivitySummary,
    SessionTypeInfo,
)
from app.services.session_types import SESSION_TYPES

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("/session-types", response_model=list[SessionTypeInfo])
def list_session_types() -> list[SessionTypeInfo]:
    return [SessionTypeInfo(**item) for item in SESSION_TYPES]


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
    body: ActivitySessionTypeUpdate,
    db: Session = Depends(get_db),
) -> Activity:
    row = db.get(Activity, activity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    row.session_type = body.session_type
    db.commit()
    db.refresh(row)
    return row

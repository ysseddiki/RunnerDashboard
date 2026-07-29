"""Routes activités."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Activity
from app.schemas import ActivityDetail, ActivitySummary

router = APIRouter(prefix="/api/activities", tags=["activities"])


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

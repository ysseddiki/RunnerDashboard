"""Routes analytics P3."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.analytics import build_overview
from app.services.training_load import DEFAULT_SERIES_DAYS, build_series

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)) -> dict:
    return build_overview(db)


@router.get("/load-series")
def analytics_load_series(
    days: int = Query(DEFAULT_SERIES_DAYS, ge=14, le=365),
    db: Session = Depends(get_db),
) -> dict:
    return build_series(db, days=days)

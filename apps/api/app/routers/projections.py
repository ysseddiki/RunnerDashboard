"""API projections d’évolution."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services import projections as projections_service

router = APIRouter(prefix="/api/projections", tags=["projections"])


@router.get("/overview")
def projections_overview(db: Session = Depends(get_db)) -> dict:
    return projections_service.build_projection(db)

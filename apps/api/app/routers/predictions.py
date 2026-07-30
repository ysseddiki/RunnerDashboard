"""Routes prévisions d’allure."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import PredictionsOverview
from app.services.predictions import build_predictions_overview

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("/overview", response_model=PredictionsOverview)
def predictions_overview(db: Session = Depends(get_db)) -> PredictionsOverview:
    return PredictionsOverview.model_validate(build_predictions_overview(db))

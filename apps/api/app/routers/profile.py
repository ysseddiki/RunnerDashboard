"""API profil coureur."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.services import athlete_profile as profile_service

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    age: int | None = Field(default=None, ge=10, le=90)
    weight_kg: float | None = Field(default=None, gt=30, lt=250)
    height_cm: float | None = Field(default=None, gt=100, lt=250)
    sex: str | None = Field(default=None, max_length=16)
    resting_hr: int | None = Field(default=None, ge=30, le=120)
    max_hr: int | None = Field(default=None, ge=100, le=230)
    goal_text: str | None = Field(default=None, max_length=500)


@router.get("")
def get_profile(db: Session = Depends(get_db)) -> dict:
    return profile_service.profile_payload(db)


@router.put("")
def put_profile(body: ProfileUpdate, db: Session = Depends(get_db)) -> dict:
    data = body.model_dump(exclude_unset=True)
    return profile_service.update_profile(db, data)

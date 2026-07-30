"""API profil coureur."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app import auth as auth_service
from app.db import get_db
from app.models import User
from app.services import athlete_profile as profile_service

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    birth_date: date | None = None
    weight_kg: float | None = Field(default=None, gt=30, lt=250)
    height_cm: float | None = Field(default=None, gt=100, lt=250)
    sex: str | None = Field(default=None, max_length=16)
    resting_hr: int | None = Field(default=None, ge=30, le=120)
    max_hr: int | None = Field(default=None, ge=100, le=230)
    goal_text: str | None = Field(default=None, max_length=500)

    @field_validator("birth_date")
    @classmethod
    def birth_not_future(cls, v: date | None) -> date | None:
        if v is None:
            return v
        if v > date.today():
            raise ValueError("La date de naissance ne peut pas être dans le futur")
        age = profile_service.age_years_from_birth(v)
        if age is None or age < 10 or age > 90:
            raise ValueError("Âge dérivé hors plage réaliste (10–90 ans)")
        return v


@router.get("")
def get_profile(
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    return profile_service.profile_payload(db, user.id)


@router.put("")
def put_profile(
    body: ProfileUpdate,
    user: User = Depends(auth_service.require_user),
    db: Session = Depends(get_db),
) -> dict:
    data = body.model_dump(exclude_unset=True)
    return profile_service.update_profile(db, user.id, data)

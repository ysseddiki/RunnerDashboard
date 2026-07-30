"""API import / matching Apple Santé."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Activity, AppleWorkout
from app.services import apple_health as apple_service
from app.services.apple_health_parse import AppleHealthParseError
from app.services.apple_match import find_candidates, score_match

router = APIRouter(prefix="/api/apple-health", tags=["apple-health"])


class MatchCandidate(BaseModel):
    activity_id: int
    activity_name: str
    strava_id: int | None = None
    start_date: str | None = None
    distance_m: float | None = None
    score: float
    confidence: str
    reasons_fr: list[str]


class AppleWorkoutOut(BaseModel):
    id: int
    apple_uuid: str
    workout_type: str | None = None
    workout_type_label_fr: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    duration_s: float | None = None
    distance_m: float | None = None
    avg_hr: float | None = None
    max_hr: float | None = None
    energy_kcal: float | None = None
    cadence_ppm: float | None = None
    activity_id: int | None = None
    imported_at: str | None = None


class ImportItem(BaseModel):
    workout: AppleWorkoutOut
    candidates: list[MatchCandidate]
    action: str
    enriched_fields: list[str] = []


class ImportResult(BaseModel):
    imported: int
    updated: int
    auto_linked: int
    promoted: int
    total: int
    items: list[ImportItem]
    message: str


class LinkRequest(BaseModel):
    activity_id: int = Field(..., ge=1)


class LinkResult(BaseModel):
    workout: AppleWorkoutOut
    activity_id: int
    enriched_fields: list[str]


class CandidatesResponse(BaseModel):
    workout: AppleWorkoutOut
    candidates: list[MatchCandidate]


class PromoteResult(BaseModel):
    workout: AppleWorkoutOut
    activity_id: int


class ActivityAppleLinkResponse(BaseModel):
    activity_id: int
    source: str
    apple_uuid: str | None = None
    linked_workout: AppleWorkoutOut | None = None
    apple_candidates: list[dict] = []


@router.post("/import", response_model=ImportResult)
async def import_apple_health(
    file: UploadFile = File(...),
    auto_link: bool = Query(True),
    auto_promote: bool = Query(True),
    db: Session = Depends(get_db),
) -> ImportResult:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Fichier ZIP attendu (export Apple Santé)",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > 800 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP trop volumineux (max 800 Mo)")
    try:
        result = apple_service.import_zip(
            db, data, auto_link=auto_link, auto_promote=auto_promote
        )
    except AppleHealthParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ImportResult.model_validate(result)


@router.get("/workouts", response_model=list[AppleWorkoutOut])
def list_workouts(
    unlinked_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[AppleWorkoutOut]:
    rows = apple_service.list_workouts(db, unlinked_only=unlinked_only, limit=limit)
    return [AppleWorkoutOut.model_validate(apple_service.workout_to_dict(w)) for w in rows]


@router.get("/workouts/{workout_id}/candidates", response_model=CandidatesResponse)
def workout_candidates(
    workout_id: int,
    db: Session = Depends(get_db),
) -> CandidatesResponse:
    workout = db.get(AppleWorkout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout Apple introuvable")
    candidates = find_candidates(db, workout)
    return CandidatesResponse(
        workout=AppleWorkoutOut.model_validate(apple_service.workout_to_dict(workout)),
        candidates=[MatchCandidate.model_validate(c) for c in candidates],
    )


@router.post("/workouts/{workout_id}/link", response_model=LinkResult)
def link_workout(
    workout_id: int,
    body: LinkRequest,
    db: Session = Depends(get_db),
) -> LinkResult:
    workout = db.get(AppleWorkout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout Apple introuvable")
    activity = db.get(Activity, body.activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    try:
        result = apple_service.link_workout(db, workout, activity)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LinkResult.model_validate(result)


@router.post("/workouts/{workout_id}/unlink")
def unlink_workout(
    workout_id: int,
    db: Session = Depends(get_db),
) -> dict:
    workout = db.get(AppleWorkout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout Apple introuvable")
    return apple_service.unlink_workout(db, workout)


@router.post("/workouts/{workout_id}/promote", response_model=PromoteResult)
def promote_workout(
    workout_id: int,
    db: Session = Depends(get_db),
) -> PromoteResult:
    workout = db.get(AppleWorkout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout Apple introuvable")
    activity = apple_service.promote_to_activity(db, workout)
    db.refresh(workout)
    return PromoteResult(
        workout=AppleWorkoutOut.model_validate(apple_service.workout_to_dict(workout)),
        activity_id=activity.id,
    )


@router.get("/activities/{activity_id}/link", response_model=ActivityAppleLinkResponse)
def activity_apple_link(
    activity_id: int,
    db: Session = Depends(get_db),
) -> ActivityAppleLinkResponse:
    activity = db.get(Activity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activité introuvable")

    workout: AppleWorkout | None = None
    if activity.apple_uuid:
        workout = db.scalar(
            select(AppleWorkout).where(AppleWorkout.apple_uuid == activity.apple_uuid)
        )
    if workout is None:
        workout = db.scalar(
            select(AppleWorkout).where(AppleWorkout.activity_id == activity_id)
        )

    nearby: list[dict] = []
    linked = workout is not None and workout.activity_id == activity_id
    if activity.strava_id and not linked and activity.start_date:
        window = timedelta(minutes=10)
        rows = db.scalars(
            select(AppleWorkout).where(
                AppleWorkout.start_date >= activity.start_date - window,
                AppleWorkout.start_date <= activity.start_date + window,
                AppleWorkout.activity_id.is_(None),
            )
        ).all()
        for w in rows:
            scored = score_match(w, activity)
            if scored:
                nearby.append(
                    {
                        "workout": apple_service.workout_to_dict(w),
                        "score": scored["score"],
                        "confidence": scored["confidence"],
                        "reasons_fr": scored["reasons_fr"],
                    }
                )
        nearby.sort(key=lambda x: x["score"], reverse=True)

    return ActivityAppleLinkResponse(
        activity_id=activity_id,
        source=activity.source or "strava",
        apple_uuid=activity.apple_uuid,
        linked_workout=(
            AppleWorkoutOut.model_validate(apple_service.workout_to_dict(workout))
            if workout
            else None
        ),
        apple_candidates=nearby[:5],
    )

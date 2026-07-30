"""Modèles Postgres."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class StravaToken(Base):
    __tablename__ = "strava_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    athlete_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    athlete_firstname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    athlete_lastname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[int] = mapped_column(BigInteger)
    scope: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strava_id: Mapped[int | None] = mapped_column(
        BigInteger, unique=True, index=True, nullable=True
    )
    athlete_id: Mapped[int] = mapped_column(BigInteger, index=True, default=0)
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="strava", server_default="strava", index=True
    )
    apple_uuid: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    sport_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    moving_time_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    elapsed_time_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_elevation_gain_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_speed_mps: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_speed_mps: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_heartrate: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_heartrate: Mapped[float | None] = mapped_column(Float, nullable=True)
    cadence_ppm: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_watts: Mapped[float | None] = mapped_column(Float, nullable=True)
    kilojoules: Mapped[float | None] = mapped_column(Float, nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary_polyline: Mapped[str | None] = mapped_column(Text, nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    trainer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    session_type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    streams_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    weather_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    raw_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    coach_analysis_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    coach_analyzed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AthleteProfile(Base):
    __tablename__ = "athlete_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Legacy: kept for DB compat; age is derived from birth_date when present.
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    resting_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AthleteProfileHistory(Base):
    """Snapshot of athlete profile fields after each save."""

    __tablename__ = "athlete_profile_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    resting_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal_text: Mapped[str | None] = mapped_column(Text, nullable=True)


class CoachPlan(Base):
    __tablename__ = "coach_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_json: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="empty")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AppleWorkout(Base):
    __tablename__ = "apple_workouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    apple_uuid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    workout_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_hr: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_hr: Mapped[float | None] = mapped_column(Float, nullable=True)
    energy_kcal: Mapped[float | None] = mapped_column(Float, nullable=True)
    cadence_ppm: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    activity_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("activities.id"), nullable=True, index=True
    )
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

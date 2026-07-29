"""Schémas API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from app.services.session_types import SESSION_TYPE_IDS, label_for


class StravaStatus(BaseModel):
    connected: bool
    athlete_id: int | None = None
    athlete_name: str | None = None
    expires_at: int | None = None


class AuthUrlResponse(BaseModel):
    url: str


class SyncResult(BaseModel):
    created: int
    updated: int
    skipped: int
    total_fetched: int
    weather_enriched: int = 0
    message: str


class WeatherInfo(BaseModel):
    observed_at: str | None = None
    temperature_c: float | None = None
    apparent_temperature_c: float | None = None
    humidity_pct: float | None = None
    precipitation_mm: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    weather_code: int | None = None
    weather_label_fr: str | None = None
    source: str | None = None


class SessionTypeInfo(BaseModel):
    id: str
    label_fr: str
    description_fr: str


class ActivitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    strava_id: int
    name: str
    sport_type: str | None
    start_date: datetime | None
    distance_m: float | None
    moving_time_s: int | None
    average_speed_mps: float | None
    average_heartrate: float | None
    cadence_ppm: float | None
    total_elevation_gain_m: float | None
    session_type: str | None = None
    weather_json: dict[str, Any] | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def session_type_label_fr(self) -> str | None:
        return label_for(self.session_type)


class ActivityDetail(ActivitySummary):
    elapsed_time_s: int | None = None
    max_speed_mps: float | None = None
    max_heartrate: float | None = None
    average_watts: float | None = None
    kilojoules: float | None = None
    calories: float | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    summary_polyline: str | None = None
    device_name: str | None = None
    trainer: bool | None = None
    timezone: str | None = None
    activity_type: str | None = None
    streams_json: dict[str, Any] | None = None
    synced_at: datetime | None = None


class ActivitySessionTypeUpdate(BaseModel):
    session_type: str | None = None

    @field_validator("session_type")
    @classmethod
    def validate_session_type(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in SESSION_TYPE_IDS:
            raise ValueError(
                f"Type de séance inconnu: {value}. "
                f"Choix: {', '.join(sorted(SESSION_TYPE_IDS))}"
            )
        return value

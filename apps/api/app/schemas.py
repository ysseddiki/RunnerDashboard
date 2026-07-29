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


class ActivityUpdate(BaseModel):
    session_type: str | None = None
    cadence_ppm: float | None = None
    clear_cadence: bool = False

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

    @field_validator("cadence_ppm")
    @classmethod
    def validate_cadence(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if value < 80 or value > 250:
            raise ValueError("Cadence PPM attendue entre 80 et 250")
        return round(float(value), 1)


class CadenceRecomputeResult(BaseModel):
    updated: int
    unchanged: int = 0
    still_missing: int
    with_streams: int = 0
    with_cadence_stream: int = 0
    with_average_cadence: int = 0
    with_laps_cadence: int = 0
    fetched: int = 0
    errors: int = 0
    remaining: int = 0
    message: str


# Alias conservé pour imports existants
ActivitySessionTypeUpdate = ActivityUpdate

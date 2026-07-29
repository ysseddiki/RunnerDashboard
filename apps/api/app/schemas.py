"""Schémas API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


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
    weather_json: dict[str, Any] | None = None


class ActivityDetail(ActivitySummary):
    elapsed_time_s: int | None
    max_speed_mps: float | None
    max_heartrate: float | None
    average_watts: float | None
    calories: float | None
    start_lat: float | None
    start_lng: float | None
    summary_polyline: str | None
    device_name: str | None
    trainer: bool | None
    streams_json: dict[str, Any] | None
    synced_at: datetime | None

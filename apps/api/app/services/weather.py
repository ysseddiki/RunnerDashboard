"""Client météo Open-Meteo (historique + récent)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("weather")

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARS = (
    "temperature_2m,apparent_temperature,relative_humidity_2m,"
    "precipitation,wind_speed_10m,wind_direction_10m,weather_code"
)

# Codes WMO simplifiés (FR)
WEATHER_LABELS_FR: dict[int, str] = {
    0: "Ciel clair",
    1: "Principalement clair",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    48: "Brouillard givrant",
    51: "Bruine légère",
    53: "Bruine",
    55: "Bruine dense",
    61: "Pluie faible",
    63: "Pluie",
    65: "Pluie forte",
    71: "Neige faible",
    73: "Neige",
    75: "Neige forte",
    80: "Averses faibles",
    81: "Averses",
    82: "Averses fortes",
    95: "Orage",
    96: "Orage avec grêle",
    99: "Orage violent avec grêle",
}


class WeatherError(Exception):
    pass


def _label_fr(code: int | None) -> str | None:
    if code is None:
        return None
    return WEATHER_LABELS_FR.get(int(code), f"Code météo {code}")


def _pick_closest_hour(
    times: list[str],
    target: datetime,
    series: dict[str, list[Any]],
) -> dict[str, Any] | None:
    if not times:
        return None
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    target_utc = target.astimezone(timezone.utc)

    best_idx = 0
    best_delta = None
    for idx, raw in enumerate(times):
        ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        delta = abs((ts - target_utc).total_seconds())
        if best_delta is None or delta < best_delta:
            best_delta = delta
            best_idx = idx

    code = series.get("weather_code", [None])[best_idx]
    code_int = int(code) if code is not None else None
    return {
        "observed_at": times[best_idx],
        "temperature_c": series.get("temperature_2m", [None])[best_idx],
        "apparent_temperature_c": series.get("apparent_temperature", [None])[best_idx],
        "humidity_pct": series.get("relative_humidity_2m", [None])[best_idx],
        "precipitation_mm": series.get("precipitation", [None])[best_idx],
        "wind_speed_kmh": series.get("wind_speed_10m", [None])[best_idx],
        "wind_direction_deg": series.get("wind_direction_10m", [None])[best_idx],
        "weather_code": code_int,
        "weather_label_fr": _label_fr(code_int),
    }


def _fetch(url: str, params: dict[str, Any]) -> dict[str, Any]:
    with httpx.Client(timeout=45.0) as client:
        response = client.get(url, params=params)
    if response.status_code >= 400:
        raise WeatherError(f"Open-Meteo HTTP {response.status_code}: {response.text[:200]}")
    return response.json()


def fetch_weather_for_activity(
    *,
    lat: float,
    lon: float,
    start_date: datetime,
) -> dict[str, Any]:
    """Retourne un dict météo normalisé pour l'heure la plus proche du départ."""
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    day = start_date.astimezone(timezone.utc).date().isoformat()
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": day,
        "end_date": day,
        "hourly": HOURLY_VARS,
        "timezone": "UTC",
    }

    age_days = (datetime.now(timezone.utc) - start_date.astimezone(timezone.utc)).days
    # Archive a ~5 jours de retard : utiliser forecast pour le récent
    urls = (
        [FORECAST_URL, ARCHIVE_URL]
        if age_days <= 5
        else [ARCHIVE_URL, FORECAST_URL]
    )

    last_error: Exception | None = None
    payload: dict[str, Any] | None = None
    source = ""
    for url in urls:
        try:
            payload = _fetch(url, params)
            source = "forecast" if "forecast" in url else "archive"
            break
        except WeatherError as exc:
            last_error = exc
            continue

    if payload is None:
        raise WeatherError(str(last_error) if last_error else "Aucune source météo")

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    series = {k: v for k, v in hourly.items() if k != "time"}
    picked = _pick_closest_hour(times, start_date, series)
    if picked is None:
        raise WeatherError("Aucune donnée horaire météo")

    picked["source"] = f"open-meteo:{source}"
    picked["lat"] = lat
    picked["lon"] = lon
    return picked

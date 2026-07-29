"""Cadence course : Strava = RPM (1 pied) → PPM (pas/min) = ×2."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("sync.strava")


def rpm_to_ppm(rpm: float | None) -> float | None:
    if rpm is None:
        return None
    try:
        value = float(rpm)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return round(value * 2, 1)


def average_cadence_rpm_from_stream(streams: dict[str, Any] | None) -> float | None:
    if not streams:
        return None
    cadence = streams.get("cadence")
    if not isinstance(cadence, dict):
        return None
    data = cadence.get("data")
    if not isinstance(data, list) or not data:
        return None
    values = [float(v) for v in data if isinstance(v, (int, float)) and v > 0]
    if not values:
        return None
    return sum(values) / len(values)


def resolve_cadence_ppm(
    raw: dict[str, Any] | None,
    streams: dict[str, Any] | None,
    *,
    strava_id: Any = None,
) -> float | None:
    """Priorité : average_cadence Strava (RPM×2), sinon moyenne du stream cadence."""
    average = None
    if isinstance(raw, dict):
        average = raw.get("average_cadence")

    ppm = rpm_to_ppm(average if isinstance(average, (int, float)) else None)
    if ppm is not None:
        return ppm

    stream_rpm = average_cadence_rpm_from_stream(streams)
    ppm = rpm_to_ppm(stream_rpm)
    if ppm is not None:
        logger.info(
            "Cadence PPM dérivée du stream | strava_id=%s | rpm=%.1f | ppm=%s",
            strava_id,
            stream_rpm,
            ppm,
        )
        return ppm

    logger.info(
        "Cadence PPM absente | strava_id=%s | reason=ni_average_ni_stream",
        strava_id,
    )
    return None

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


def _numeric_list(data: Any) -> list[float]:
    if not isinstance(data, list):
        return []
    return [float(v) for v in data if isinstance(v, (int, float)) and v > 0]


def average_cadence_rpm_from_stream(streams: dict[str, Any] | None) -> float | None:
    if not streams:
        return None
    cadence = streams.get("cadence")
    if isinstance(cadence, dict):
        values = _numeric_list(cadence.get("data"))
        if values:
            return sum(values) / len(values)
    if isinstance(cadence, list):
        values = _numeric_list(cadence)
        if values:
            return sum(values) / len(values)
    return None


def average_cadence_rpm_from_raw(raw: dict[str, Any] | None) -> float | None:
    """Cherche average_cadence activité, puis moyenne des laps/splits si présents."""
    if not isinstance(raw, dict):
        return None

    avg = raw.get("average_cadence")
    if isinstance(avg, (int, float)) and avg > 0:
        return float(avg)

    collected: list[float] = []
    for key in ("laps", "splits_metric", "splits_standard"):
        items = raw.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            cad = item.get("average_cadence")
            if isinstance(cad, (int, float)) and cad > 0:
                collected.append(float(cad))
    if collected:
        return sum(collected) / len(collected)
    return None


def resolve_cadence_ppm(
    raw: dict[str, Any] | None,
    streams: dict[str, Any] | None,
    *,
    strava_id: Any = None,
) -> float | None:
    """Priorité : average_cadence / laps Strava (RPM×2), sinon moyenne du stream cadence."""
    rpm = average_cadence_rpm_from_raw(raw)
    ppm = rpm_to_ppm(rpm)
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


def cadence_source_stats(
    raw: dict[str, Any] | None,
    streams: dict[str, Any] | None,
) -> dict[str, bool]:
    has_streams = isinstance(streams, dict) and bool(streams)
    has_cadence_stream = average_cadence_rpm_from_stream(streams) is not None
    has_average = False
    if isinstance(raw, dict):
        avg = raw.get("average_cadence")
        has_average = isinstance(avg, (int, float)) and avg > 0
    has_laps_cadence = average_cadence_rpm_from_raw(raw) is not None and not has_average
    return {
        "has_streams": has_streams,
        "has_cadence_stream": has_cadence_stream,
        "has_average_cadence": has_average,
        "has_laps_cadence": has_laps_cadence,
    }

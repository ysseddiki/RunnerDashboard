"""Parse export Apple Santé (ZIP + export.xml) — workouts only."""

from __future__ import annotations

import io
import logging
import re
import zipfile
from datetime import datetime, timezone
from typing import Any
from xml.etree.ElementTree import iterparse

logger = logging.getLogger("apple_health.parse")

# Types HealthKit retenus (course / marche / trail)
ALLOWED_WORKOUT_TYPES = frozenset(
    {
        "HKWorkoutActivityTypeRunning",
        "HKWorkoutActivityTypeWalking",
        "HKWorkoutActivityTypeHiking",
        "HKWorkoutActivityTypeTrailRunning",
    }
)

DISTANCE_UNITS_TO_M = {
    "m": 1.0,
    "meter": 1.0,
    "meters": 1.0,
    "km": 1000.0,
    "kilometer": 1000.0,
    "kilometers": 1000.0,
    "mi": 1609.344,
    "mile": 1609.344,
    "miles": 1609.344,
}


class AppleHealthParseError(Exception):
    pass


def _parse_apple_date(value: str | None) -> datetime | None:
    if not value:
        return None
    # Formats typiques : 2024-03-15 08:12:33 +0100
    text = value.strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ):
        try:
            dt = datetime.strptime(text.replace("Z", "+0000"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    # Fallback : strip timezone name in parentheses
    cleaned = re.sub(r"\s+\([^)]+\)\s*$", "", text)
    try:
        dt = datetime.strptime(cleaned, "%Y-%m-%d %H:%M:%S %z")
        return dt.astimezone(timezone.utc)
    except ValueError:
        logger.warning("Date Apple illisible | value=%s", value[:80])
        return None


def _to_meters(value: str | None, unit: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        num = float(value)
    except ValueError:
        return None
    factor = DISTANCE_UNITS_TO_M.get((unit or "m").lower(), 1.0)
    return num * factor


def _stat_value(elem, type_suffix: str) -> float | None:
    """Lit WorkoutStatistics type contenant type_suffix."""
    for child in elem:
        tag = child.tag.split("}")[-1]
        if tag != "WorkoutStatistics":
            continue
        stype = child.attrib.get("type") or ""
        if type_suffix not in stype:
            continue
        for key in ("average", "sum", "maximum", "minimum"):
            raw = child.attrib.get(key)
            if raw is not None:
                try:
                    return float(raw)
                except ValueError:
                    continue
    return None


def _metadata_float(elem, key: str) -> float | None:
    for child in elem:
        tag = child.tag.split("}")[-1]
        if tag != "MetadataEntry":
            continue
        if (child.attrib.get("key") or "") != key:
            continue
        try:
            return float(child.attrib.get("value") or "")
        except ValueError:
            return None
    return None


def _workout_from_elem(elem) -> dict[str, Any] | None:
    wtype = elem.attrib.get("workoutActivityType") or ""
    if wtype not in ALLOWED_WORKOUT_TYPES:
        return None

    apple_uuid = (elem.attrib.get("UUID") or elem.attrib.get("uuid") or "").strip()
    if not apple_uuid:
        # Fallback stable-ish id from start+type+duration
        start = elem.attrib.get("startDate") or ""
        apple_uuid = f"synthetic-{wtype}-{start}-{elem.attrib.get('duration', '')}"

    duration_s = None
    try:
        if elem.attrib.get("duration") is not None:
            duration_s = float(elem.attrib["duration"])
            # Apple souvent en minutes si durationUnit=min
            unit = (elem.attrib.get("durationUnit") or "min").lower()
            if unit in {"min", "minute", "minutes"}:
                duration_s *= 60.0
            elif unit in {"h", "hr", "hour", "hours"}:
                duration_s *= 3600.0
    except ValueError:
        duration_s = None

    distance_m = _to_meters(
        elem.attrib.get("totalDistance"),
        elem.attrib.get("totalDistanceUnit"),
    )
    if distance_m is None:
        # Parfois uniquement en statistics
        dist_stat = _stat_value(elem, "Distance")
        if dist_stat is not None:
            distance_m = dist_stat  # souvent déjà en m pour DistanceWalkingRunning

    energy = None
    try:
        if elem.attrib.get("totalEnergyBurned") is not None:
            energy = float(elem.attrib["totalEnergyBurned"])
    except ValueError:
        energy = None
    if energy is None:
        energy = _stat_value(elem, "EnergyBurned") or _stat_value(elem, "ActiveEnergy")

    avg_hr = _stat_value(elem, "HeartRate")
    # maximum on same statistic if present
    max_hr = None
    for child in elem:
        tag = child.tag.split("}")[-1]
        if tag != "WorkoutStatistics":
            continue
        if "HeartRate" not in (child.attrib.get("type") or ""):
            continue
        try:
            if child.attrib.get("maximum") is not None:
                max_hr = float(child.attrib["maximum"])
            if avg_hr is None and child.attrib.get("average") is not None:
                avg_hr = float(child.attrib["average"])
        except ValueError:
            pass

    cadence = (
        _metadata_float(elem, "Average Cadence")
        or _metadata_float(elem, "HKMetadataKeyAverageCadence")
    )
    # Cadence parfois en MetadataEntry HKIndoorWorkout etc. — chercher clés cadence
    if cadence is None:
        for child in elem:
            tag = child.tag.split("}")[-1]
            if tag != "MetadataEntry":
                continue
            key = (child.attrib.get("key") or "").lower()
            if "cadence" in key or "step" in key:
                try:
                    cadence = float(child.attrib.get("value") or "")
                    break
                except ValueError:
                    pass

    # Si cadence semble en SPM un pied (< 100), convertir en PPM
    if cadence is not None and 40 <= cadence < 100:
        cadence = round(cadence * 2, 1)
    elif cadence is not None:
        cadence = round(cadence, 1)

    start_date = _parse_apple_date(elem.attrib.get("startDate"))
    end_date = _parse_apple_date(elem.attrib.get("endDate"))

    raw = {
        "workoutActivityType": wtype,
        "UUID": apple_uuid,
        "startDate": elem.attrib.get("startDate"),
        "endDate": elem.attrib.get("endDate"),
        "duration": elem.attrib.get("duration"),
        "durationUnit": elem.attrib.get("durationUnit"),
        "totalDistance": elem.attrib.get("totalDistance"),
        "totalDistanceUnit": elem.attrib.get("totalDistanceUnit"),
        "totalEnergyBurned": elem.attrib.get("totalEnergyBurned"),
        "sourceName": elem.attrib.get("sourceName"),
    }

    return {
        "apple_uuid": apple_uuid,
        "workout_type": wtype,
        "start_date": start_date,
        "end_date": end_date,
        "duration_s": duration_s,
        "distance_m": distance_m,
        "avg_hr": avg_hr,
        "max_hr": max_hr,
        "energy_kcal": energy,
        "cadence_ppm": cadence,
        "raw_json": raw,
    }


def _find_export_xml(zf: zipfile.ZipFile) -> str:
    names = zf.namelist()
    for name in names:
        if name.endswith("export.xml") and not name.endswith("/"):
            return name
    raise AppleHealthParseError(
        "Fichier export.xml introuvable dans le ZIP | action=vérifier_export_Apple_Santé"
    )


def parse_workouts_from_zip(data: bytes) -> list[dict[str, Any]]:
    """Extrait les workouts running/walking/hiking d’un ZIP Apple Santé."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise AppleHealthParseError(
            "ZIP invalide | action=exporter_à_nouveau_depuis_Apple_Santé"
        ) from exc

    xml_name = _find_export_xml(zf)
    logger.info("Parse export Apple | xml=%s | zip_entries=%s", xml_name, len(zf.namelist()))

    workouts: list[dict[str, Any]] = []
    with zf.open(xml_name) as fh:
        # iterparse pour gros fichiers
        context = iterparse(fh, events=("end",))
        for _event, elem in context:
            tag = elem.tag.split("}")[-1]
            if tag != "Workout":
                elem.clear()
                continue
            parsed = _workout_from_elem(elem)
            if parsed:
                workouts.append(parsed)
            elem.clear()

    logger.info("Workouts Apple retenus | count=%s", len(workouts))
    return workouts

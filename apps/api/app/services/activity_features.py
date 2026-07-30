"""Features déterministes par activité (streams + profil).

Contrat `features_json` (schema_version=1) :
- schema_version, computed_at, input_fingerprint, profile_fingerprint
- quality_flags: has_hr, has_streams, has_gps, running_eligible
- unavailable: list[{key, reason_fr}]
- splits_km, time_in_zone, decoupling, trimp_edwards, cv_pace, cv_hr
- session (bloc spécifique au session_type) : easy / long_run / tempo / intervals / race
- chart_overlays: zones_hr, interval_segments (pour l’UI, pas de recalcul front)
"""

from __future__ import annotations

import hashlib
import logging
import statistics
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.models import Activity, AthleteProfile

logger = logging.getLogger("activity.features")

FEATURES_SCHEMA_VERSION = 1

RUNNING_SPORT_TYPES = frozenset({"Run", "TrailRun", "VirtualRun"})

EASY_SESSION_TYPES = frozenset(
    {"ef", "recuperation", "endurance_active", "sortie_longue"}
)
QUALITY_SESSION_TYPES = frozenset(
    {
        "tempo",
        "seuil",
        "fractionne",
        "vma",
        "cotes",
        "fartlek",
        "competition",
        "test",
    }
)

# Edwards TRIMP : minutes × facteur de zone
EDWARDS_FACTORS = {"Z1": 1, "Z2": 2, "Z3": 3, "Z4": 4, "Z5": 5}

ACR_HIGH_THRESHOLD = 1.3


def is_running_eligible(activity: Any) -> bool:
    """Pool analytics : courses uniquement (pas Walk/Hiking)."""
    sport = (getattr(activity, "sport_type", None) or "").strip()
    atype = (getattr(activity, "activity_type", None) or "").strip()
    non_run = {"Walk", "Hiking", "Hike", "WalkWorkout"}
    if sport in non_run or atype in non_run:
        return False
    if sport in RUNNING_SPORT_TYPES or atype in RUNNING_SPORT_TYPES:
        return True
    return False


def profile_fingerprint(zones: dict[str, Any] | None) -> str:
    if not zones or not zones.get("available"):
        return "no-zones"
    parts = [
        str(zones.get("method") or ""),
        str(zones.get("max_hr_used") or ""),
        str(zones.get("resting_hr_used") or ""),
    ]
    for z in zones.get("zones") or []:
        parts.append(f"{z.get('id')}:{z.get('hr_low')}-{z.get('hr_high')}")
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _input_fingerprint(
    activity: Activity,
    *,
    profile_fp: str,
) -> str:
    streams = activity.streams_json if isinstance(activity.streams_json, dict) else None
    stream_keys = ",".join(sorted(streams.keys())) if streams else ""
    n_hr = 0
    if streams and isinstance(streams.get("heartrate"), dict):
        data = streams["heartrate"].get("data") or []
        n_hr = len(data) if isinstance(data, list) else 0
    raw = (
        f"v{FEATURES_SCHEMA_VERSION}|{profile_fp}|{activity.session_type or ''}|"
        f"{bool(streams)}|{stream_keys}|{n_hr}|"
        f"{activity.distance_m or 0}|{activity.moving_time_s or 0}|"
        f"{activity.average_heartrate or ''}"
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:20]


def _numeric_stream(streams: dict[str, Any], key: str) -> list[float | None]:
    payload = streams.get(key)
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if not isinstance(data, list):
        return []
    out: list[float | None] = []
    for v in data:
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            out.append(float(v))
        else:
            out.append(None)
    return out


def _align_streams(streams: dict[str, Any]) -> list[dict[str, Any]]:
    time_s = _numeric_stream(streams, "time")
    distance = _numeric_stream(streams, "distance")
    velocity = _numeric_stream(streams, "velocity_smooth")
    heartrate = _numeric_stream(streams, "heartrate")
    cadence = _numeric_stream(streams, "cadence")
    moving = _numeric_stream(streams, "moving")
    grade = _numeric_stream(streams, "grade_smooth")
    n = max(
        len(time_s),
        len(distance),
        len(velocity),
        len(heartrate),
        len(cadence),
        len(moving),
        len(grade),
        0,
    )
    if n == 0:
        return []
    points: list[dict[str, Any]] = []
    for i in range(n):
        speed = velocity[i] if i < len(velocity) else None
        dist = distance[i] if i < len(distance) else None
        if dist is None and points:
            dist = points[-1]["distance_m"]
        hr = heartrate[i] if i < len(heartrate) else None
        cad = cadence[i] if i < len(cadence) else None
        # Strava cadence stream = RPM → PPM
        cad_ppm = round(cad * 2) if cad is not None else None
        t = time_s[i] if i < len(time_s) else float(i)
        mv = moving[i] if i < len(moving) else None
        is_moving = True if mv is None else bool(mv)
        points.append(
            {
                "index": i,
                "time_s": t,
                "distance_m": dist or 0.0,
                "speed_mps": speed,
                "pace_sec_per_km": (1000.0 / speed) if speed and speed > 0.2 else None,
                "heartrate": hr,
                "cadence_ppm": cad_ppm,
                "moving": is_moving,
                "grade": grade[i] if i < len(grade) else None,
            }
        )
    return points


def _zone_id_for_hr(hr: float, zones: list[dict[str, Any]]) -> str | None:
    for z in zones:
        lo = z.get("hr_low")
        hi = z.get("hr_high")
        if lo is None or hi is None:
            continue
        if lo <= hr <= hi:
            return str(z.get("id"))
    # Hors plage : clamp Z1 / Z5
    if zones:
        if hr < (zones[0].get("hr_low") or 0):
            return str(zones[0].get("id"))
        return str(zones[-1].get("id"))
    return None


def _cv(values: list[float]) -> float | None:
    if len(values) < 5:
        return None
    mu = statistics.mean(values)
    if mu <= 0:
        return None
    return round(statistics.pstdev(values) / mu, 4)


def _compute_splits(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not points:
        return []
    max_dist = points[-1]["distance_m"]
    if max_dist < 200:
        return []
    splits: list[dict[str, Any]] = []
    km_idx = 1
    bucket: list[dict[str, Any]] = []
    start_t = points[0]["time_s"]
    start_d = points[0]["distance_m"]
    for p in points:
        bucket.append(p)
        if p["distance_m"] - start_d >= 1000 or (
            p is points[-1] and p["distance_m"] - start_d >= 200
        ):
            end_t = p["time_s"]
            end_d = p["distance_m"]
            dist = end_d - start_d
            dur = end_t - start_t
            hrs = [x["heartrate"] for x in bucket if x["heartrate"]]
            cads = [x["cadence_ppm"] for x in bucket if x["cadence_ppm"]]
            pace = (dur / dist * 1000.0) if dist > 10 and dur > 0 else None
            splits.append(
                {
                    "km": km_idx,
                    "distance_m": round(dist, 1),
                    "duration_s": round(dur, 1),
                    "pace_sec_per_km": round(pace, 1) if pace else None,
                    "avg_hr": round(statistics.mean(hrs), 1) if hrs else None,
                    "avg_cadence_ppm": round(statistics.mean(cads), 1) if cads else None,
                }
            )
            km_idx += 1
            bucket = []
            start_t = end_t
            start_d = end_d
            if end_d >= max_dist - 1:
                break
    return splits


def _time_in_zone_and_trimp(
    points: list[dict[str, Any]], zones_payload: dict[str, Any]
) -> tuple[dict[str, Any] | None, float | None, list[str]]:
    unavailable: list[str] = []
    zones = zones_payload.get("zones") or []
    if not zones_payload.get("available") or not zones:
        return None, None, ["time_in_zone", "trimp_edwards"]
    hrs = [p for p in points if p.get("heartrate") and p.get("moving")]
    if len(hrs) < 10:
        return None, None, ["time_in_zone", "trimp_edwards"]

    seconds = {z["id"]: 0.0 for z in zones}
    for i in range(1, len(points)):
        prev, cur = points[i - 1], points[i]
        if not cur.get("moving") or not cur.get("heartrate"):
            continue
        dt = max(0.0, float(cur["time_s"]) - float(prev["time_s"]))
        if dt <= 0 or dt > 30:
            continue
        zid = _zone_id_for_hr(float(cur["heartrate"]), zones)
        if zid and zid in seconds:
            seconds[zid] += dt

    total = sum(seconds.values())
    if total < 30:
        return None, None, ["time_in_zone", "trimp_edwards"]

    time_in_zone = {
        zid: {
            "seconds": round(sec, 1),
            "pct": round(100.0 * sec / total, 1),
            "minutes": round(sec / 60.0, 2),
        }
        for zid, sec in seconds.items()
    }
    trimp = 0.0
    for zid, sec in seconds.items():
        trimp += (sec / 60.0) * EDWARDS_FACTORS.get(zid, 1)
    return time_in_zone, round(trimp, 2), unavailable


def _decoupling(points: list[dict[str, Any]]) -> float | None:
    """% dérive : (EF 2e moitié − EF 1re) / EF 1re ; EF = FC / vitesse."""
    usable = [
        p
        for p in points
        if p.get("moving")
        and p.get("heartrate")
        and p.get("speed_mps")
        and p["speed_mps"] > 0.5
    ]
    if len(usable) < 40:
        return None
    mid = len(usable) // 2
    first, second = usable[:mid], usable[mid:]

    def ef(chunk: list[dict[str, Any]]) -> float | None:
        ratios = [p["heartrate"] / p["speed_mps"] for p in chunk]
        return statistics.mean(ratios) if ratios else None

    ef1, ef2 = ef(first), ef(second)
    if ef1 is None or ef2 is None or ef1 <= 0:
        return None
    return round(((ef2 - ef1) / ef1) * 100.0, 2)


def _detect_intervals(points: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Heuristique : segments au-dessus de 1.25 × médiane de la moitié lente."""
    speeds = [
        p["speed_mps"]
        for p in points
        if p.get("moving") and p.get("speed_mps") and p["speed_mps"] > 0.5
    ]
    if len(speeds) < 60:
        return None
    ordered = sorted(speeds)
    easy_ref = statistics.median(ordered[: max(1, len(ordered) // 2)])
    if easy_ref <= 0:
        return None
    threshold = easy_ref * 1.25
    work = [p.get("speed_mps", 0) >= threshold and p.get("moving") for p in points]

    segments: list[dict[str, Any]] = []
    i = 0
    n = len(points)
    while i < n:
        if not work[i]:
            i += 1
            continue
        start = i
        while i < n and work[i]:
            i += 1
        end = i - 1
        dur = points[end]["time_s"] - points[start]["time_s"]
        dist = points[end]["distance_m"] - points[start]["distance_m"]
        if dur < 12 or dist < 30:
            continue
        chunk = points[start : end + 1]
        pace_vals = [p["pace_sec_per_km"] for p in chunk if p.get("pace_sec_per_km")]
        hr_vals = [p["heartrate"] for p in chunk if p.get("heartrate")]
        segments.append(
            {
                "kind": "work",
                "start_index": start,
                "end_index": end,
                "start_distance_m": round(points[start]["distance_m"], 1),
                "end_distance_m": round(points[end]["distance_m"], 1),
                "duration_s": round(dur, 1),
                "distance_m": round(dist, 1),
                "pace_sec_per_km": round(statistics.mean(pace_vals), 1) if pace_vals else None,
                "avg_hr": round(statistics.mean(hr_vals), 1) if hr_vals else None,
            }
        )

    if len(segments) < 2:
        return None
    conf = "basse"
    if len(segments) >= 4 and all(s["duration_s"] >= 20 for s in segments):
        conf = "haute"
    elif len(segments) >= 3:
        conf = "moyenne"
    elif len(segments) >= 2:
        conf = "basse"
    return {
        "confidence": conf,
        "count": len(segments),
        "reps": segments,
        "threshold_speed_mps": round(threshold, 3),
        "median_speed_mps": round(easy_ref, 3),
    }


def _session_enrichment(
    session_type: str | None,
    *,
    time_in_zone: dict[str, Any] | None,
    decoupling: float | None,
    splits: list[dict[str, Any]],
    cv_pace: float | None,
    intervals: dict[str, Any] | None,
    points: list[dict[str, Any]],
) -> dict[str, Any]:
    st = session_type or ""
    out: dict[str, Any] = {"family": "generic"}

    if st in {"ef", "recuperation", "endurance_active"}:
        out["family"] = "easy"
        z12 = 0.0
        if time_in_zone:
            z12 = (time_in_zone.get("Z1", {}).get("pct") or 0) + (
                time_in_zone.get("Z2", {}).get("pct") or 0
            )
        out["pct_z1_z2"] = round(z12, 1) if time_in_zone else None
        # pics hors Z1–Z2
        high = 0
        total = 0
        if time_in_zone:
            for zid in ("Z3", "Z4", "Z5"):
                high += time_in_zone.get(zid, {}).get("seconds") or 0
            total = sum(z.get("seconds") or 0 for z in time_in_zone.values())
        out["pct_above_z2"] = round(100.0 * high / total, 1) if total else None

    elif st == "sortie_longue":
        out["family"] = "long_run"
        out["decoupling_pct"] = decoupling
        if len(splits) >= 2:
            first_half = splits[: len(splits) // 2]
            second_half = splits[len(splits) // 2 :]
            p1 = [s["pace_sec_per_km"] for s in first_half if s.get("pace_sec_per_km")]
            p2 = [s["pace_sec_per_km"] for s in second_half if s.get("pace_sec_per_km")]
            if p1 and p2:
                out["split_delta_sec_per_km"] = round(
                    statistics.mean(p2) - statistics.mean(p1), 1
                )
            else:
                out["split_delta_sec_per_km"] = None
        else:
            out["split_delta_sec_per_km"] = None

    elif st in {"tempo", "seuil"}:
        out["family"] = "tempo"
        out["cv_pace"] = cv_pace
        out["regularity"] = (
            "bonne" if cv_pace is not None and cv_pace < 0.06 else
            "moyenne" if cv_pace is not None and cv_pace < 0.12 else
            "faible" if cv_pace is not None else None
        )

    elif st in {"fractionne", "vma", "cotes", "fartlek"}:
        out["family"] = "intervals"
        out["intervals"] = intervals
        if st == "cotes":
            climbs = [
                p for p in points
                if p.get("grade") is not None and p["grade"] >= 3 and p.get("moving")
            ]
            out["climb_sample_count"] = len(climbs)

    elif st in {"competition", "test"}:
        out["family"] = "race"
        if len(splits) >= 2:
            paces = [s["pace_sec_per_km"] for s in splits if s.get("pace_sec_per_km")]
            out["even_pacing_cv"] = _cv(paces) if paces else None
        else:
            out["even_pacing_cv"] = None

    return out


def compute_features(
    activity: Activity,
    *,
    zones: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calcule le document features (ne persiste pas)."""
    unavailable: list[dict[str, str]] = []
    streams = activity.streams_json if isinstance(activity.streams_json, dict) else None
    points = _align_streams(streams) if streams else []

    has_streams = len(points) > 0
    has_hr = bool(
        activity.average_heartrate
        or any(p.get("heartrate") for p in points)
    )
    has_gps = bool(
        activity.start_lat is not None
        or (streams and isinstance(streams.get("latlng"), dict))
    )
    running = is_running_eligible(activity)
    zones_payload = zones or {"available": False, "zones": []}
    profile_fp = profile_fingerprint(zones_payload)

    quality_flags = {
        "has_hr": has_hr,
        "has_streams": has_streams,
        "has_gps": has_gps,
        "running_eligible": running,
    }

    splits: list[dict[str, Any]] = []
    time_in_zone = None
    trimp = None
    decoupling = None
    cv_pace = None
    cv_hr = None
    intervals = None
    chart_overlays: dict[str, Any] = {}

    if has_streams:
        splits = _compute_splits(points)
        time_in_zone, trimp, miss = _time_in_zone_and_trimp(points, zones_payload)
        for key in miss:
            unavailable.append(
                {
                    "key": key,
                    "reason_fr": "Zones FC profil ou stream FC insuffisant.",
                }
            )
        decoupling = _decoupling(points)
        if decoupling is None:
            unavailable.append(
                {
                    "key": "decoupling",
                    "reason_fr": "Pas assez de samples FC + allure pour la dérive.",
                }
            )
        pace_vals = [
            p["pace_sec_per_km"]
            for p in points
            if p.get("moving") and p.get("pace_sec_per_km")
        ]
        hr_vals = [
            p["heartrate"] for p in points if p.get("moving") and p.get("heartrate")
        ]
        cv_pace = _cv(pace_vals)  # type: ignore[arg-type]
        cv_hr = _cv(hr_vals)  # type: ignore[arg-type]
        intervals = _detect_intervals(points)
        if time_in_zone:
            chart_overlays["zones_summary"] = time_in_zone
        if intervals and intervals.get("reps"):
            chart_overlays["interval_segments"] = [
                {
                    "start_distance_m": r["start_distance_m"],
                    "end_distance_m": r["end_distance_m"],
                    "kind": r["kind"],
                }
                for r in intervals["reps"]
            ]
    else:
        for key in (
            "splits_km",
            "time_in_zone",
            "trimp_edwards",
            "decoupling",
            "cv_pace",
            "cv_hr",
            "intervals",
        ):
            unavailable.append(
                {"key": key, "reason_fr": "Pas de streams disponibles."}
            )

    session_block = _session_enrichment(
        activity.session_type,
        time_in_zone=time_in_zone,
        decoupling=decoupling,
        splits=splits,
        cv_pace=cv_pace,
        intervals=intervals,
        points=points,
    )

    # Intervalles attendus mais non détectés
    if activity.session_type in {"fractionne", "vma", "cotes"} and intervals is None:
        unavailable.append(
            {
                "key": "intervals",
                "reason_fr": "Intervalles non détectés (confiance insuffisante).",
            }
        )

    return {
        "schema_version": FEATURES_SCHEMA_VERSION,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "profile_fingerprint": profile_fp,
        "input_fingerprint": _input_fingerprint(activity, profile_fp=profile_fp),
        "quality_flags": quality_flags,
        "unavailable": unavailable,
        "splits_km": splits or None,
        "time_in_zone": time_in_zone,
        "trimp_edwards": trimp,
        "decoupling_pct": decoupling,
        "cv_pace": cv_pace,
        "cv_hr": cv_hr,
        "intervals": intervals,
        "session": session_block,
        "chart_overlays": chart_overlays or None,
    }


def apply_features(
    db: Session,
    activity: Activity,
    *,
    force: bool = False,
    zones: dict[str, Any] | None = None,
) -> bool:
    """Calcule et persiste features_json. Retourne True si écrit."""
    from app.services import athlete_profile as profile_service

    if zones is None:
        profile = profile_service.get_or_create_profile(db)
        zones = profile_service.compute_zones(profile)

    profile_fp = profile_fingerprint(zones)
    new_fp = _input_fingerprint(activity, profile_fp=profile_fp)
    existing = activity.features_json if isinstance(activity.features_json, dict) else None
    if (
        not force
        and existing
        and existing.get("input_fingerprint") == new_fp
        and existing.get("schema_version") == FEATURES_SCHEMA_VERSION
    ):
        return False

    activity.features_json = compute_features(activity, zones=zones)
    return True


def recompute_features_batch(
    db: Session,
    *,
    force: bool = False,
    limit: int | None = None,
) -> dict[str, int]:
    """Recalcule features pour les activités. Logs FR."""
    from app.models import Activity
    from app.services import athlete_profile as profile_service

    profile = profile_service.get_or_create_profile(db)
    zones = profile_service.compute_zones(profile)

    stmt = select(Activity).order_by(Activity.start_date.desc().nullslast())
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = list(db.scalars(stmt).all())

    updated = skipped = errors = 0
    for activity in rows:
        try:
            if apply_features(db, activity, force=force, zones=zones):
                updated += 1
            else:
                skipped += 1
        except Exception:
            errors += 1
            logger.exception(
                "Échec calcul features | activity_id=%s", activity.id
            )

    db.commit()
    logger.info(
        "Recalcul features | updated=%s | skipped=%s | errors=%s | total=%s",
        updated,
        skipped,
        errors,
        len(rows),
    )
    return {
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "total": len(rows),
    }


def zones_fields_changed(before: dict[str, Any], after: Any) -> bool:
    """True si FC max/repos/naissance ont changé (impact zones)."""
    keys = ("resting_hr", "max_hr", "birth_date")
    for k in keys:
        if before.get(k) != getattr(after, k):
            return True
    return False

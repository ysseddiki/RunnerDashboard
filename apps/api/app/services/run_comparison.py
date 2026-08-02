"""Comparaison intelligente de deux activités running (déterministe)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Literal

from app.services.session_type_trends import direction_lower_better
from app.services.session_types import label_for

Direction = Literal["mieux", "stable", "moins_bon", "indetermine"]

DISTANCE_CAVEAT_PCT = 20.0
TEMP_CAVEAT_C = 6.0
STABLE_PACE_PCT = 1.5
STABLE_HR_BPM = 3.0
STABLE_ELEV_M = 15.0
STABLE_CADENCE = 2.0


def _as_date(value: datetime | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).date()
        return value.date()
    if isinstance(value, date):
        return value
    return None


def days_between(a_start: datetime | date | None, b_start: datetime | date | None) -> int | None:
    da = _as_date(a_start)
    db = _as_date(b_start)
    if da is None or db is None:
        return None
    return abs((db - da).days)


def interval_label_fr(days: int | None) -> str:
    if days is None:
        return "intervalle inconnu"
    if days == 0:
        return "le même jour"
    if days == 1:
        return "1 jour"
    if days < 14:
        return f"{days} jours"
    weeks = days // 7
    rem = days % 7
    if days < 60:
        if rem == 0:
            return f"{weeks} semaine{'s' if weeks > 1 else ''}"
        return f"{weeks} semaine{'s' if weeks > 1 else ''} et {rem} jour{'s' if rem > 1 else ''}"
    months = max(1, round(days / 30.4))
    if months == 1:
        return "environ 1 mois"
    return f"environ {months} mois"


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return 1000.0 / mps


def _feat_num(activity: Any, *keys: str) -> float | None:
    feat = getattr(activity, "features_json", None)
    if not isinstance(feat, dict):
        return None
    for key in keys:
        val = feat.get(key)
        if val is None:
            continue
        try:
            return float(val)
        except (TypeError, ValueError):
            continue
    return None


def _weather_temp(activity: Any) -> float | None:
    w = getattr(activity, "weather_json", None)
    if not isinstance(w, dict):
        return None
    t = w.get("temperature_c")
    if t is None:
        return None
    try:
        return float(t)
    except (TypeError, ValueError):
        return None


def _format_pace(sec: float | None) -> str | None:
    if sec is None or not (sec > 0):
        return None
    total = int(round(sec))
    m, s = divmod(total, 60)
    return f"{m}:{s:02d} /km"


def _format_km(meters: float | None) -> str | None:
    if meters is None:
        return None
    return f"{meters / 1000.0:.2f} km"


def _format_num(value: float | None, *, unit: str = "", digits: int = 0) -> str | None:
    if value is None:
        return None
    if digits == 0:
        return f"{int(round(value))}{unit}"
    return f"{value:.{digits}f}{unit}"


def _direction_hr(
    a_hr: float | None,
    b_hr: float | None,
    pace_dir: Direction,
) -> Direction:
    if a_hr is None or b_hr is None:
        return "indetermine"
    delta = b_hr - a_hr
    if abs(delta) < STABLE_HR_BPM:
        return "stable"
    # Lower HR is better when pace is same or better
    if pace_dir in ("mieux", "stable"):
        return "mieux" if delta < 0 else "moins_bon"
    # Pace worse: lower HR alone is ambiguous
    return "indetermine"


def _direction_higher_better(a: float | None, b: float | None, *, stable: float) -> Direction:
    if a is None or b is None:
        return "indetermine"
    delta = b - a
    if abs(delta) < stable:
        return "stable"
    return "mieux" if delta > 0 else "moins_bon"


def _metric(
    *,
    key: str,
    label_fr: str,
    value_a: float | None,
    value_b: float | None,
    display_a: str | None,
    display_b: str | None,
    delta: float | None,
    delta_display: str | None,
    direction: Direction,
    note_fr: str | None = None,
) -> dict[str, Any] | None:
    if value_a is None and value_b is None:
        return None
    return {
        "key": key,
        "label_fr": label_fr,
        "value_a": value_a,
        "value_b": value_b,
        "display_a": display_a or "—",
        "display_b": display_b or "—",
        "delta": delta,
        "delta_display_fr": delta_display,
        "direction": direction,
        "note_fr": note_fr,
    }


def _activity_card(activity: Any) -> dict[str, Any]:
    return {
        "id": int(activity.id),
        "name": getattr(activity, "name", None) or "Sans nom",
        "start_date": getattr(activity, "start_date", None),
        "distance_m": getattr(activity, "distance_m", None),
        "moving_time_s": getattr(activity, "moving_time_s", None),
        "average_speed_mps": getattr(activity, "average_speed_mps", None),
        "average_heartrate": getattr(activity, "average_heartrate", None),
        "cadence_ppm": getattr(activity, "cadence_ppm", None),
        "total_elevation_gain_m": getattr(activity, "total_elevation_gain_m", None),
        "session_type": getattr(activity, "session_type", None),
        "session_type_label_fr": label_for(getattr(activity, "session_type", None)),
        "terrain": getattr(activity, "terrain", None),
    }


def compare_activities(activity_a: Any, activity_b: Any) -> dict[str, Any]:
    """Compare two activities already ordered as A (older) → B (newer)."""
    days = days_between(
        getattr(activity_a, "start_date", None),
        getattr(activity_b, "start_date", None),
    )
    label = interval_label_fr(days)

    if days == 0:
        intro_fr = (
            "Ces deux sorties ont lieu le même jour. "
            "La lecture porte sur l’écart de performance, pas sur un progrès dans le temps."
        )
    elif days is None:
        intro_fr = "Intervalle entre les deux sorties inconnu (dates manquantes)."
    else:
        intro_fr = (
            f"Entre ces deux sorties, {label} se sont écoulés "
            f"(de la plus ancienne à la plus récente)."
        )

    caveats: list[str] = []
    dist_a = getattr(activity_a, "distance_m", None)
    dist_b = getattr(activity_b, "distance_m", None)
    distances_comparable = True
    if dist_a and dist_b and dist_a > 0 and dist_b > 0:
        ratio = abs(dist_b - dist_a) / max(dist_a, dist_b) * 100.0
        if ratio > DISTANCE_CAVEAT_PCT:
            distances_comparable = False
            caveats.append(
                f"Distances très différentes ({_format_km(dist_a)} vs {_format_km(dist_b)}) : "
                "l’allure n’est pas directement comparable sans réserve."
            )

    type_a = getattr(activity_a, "session_type", None)
    type_b = getattr(activity_b, "session_type", None)
    types_differ = bool(type_a and type_b and type_a != type_b)
    if types_differ:
        caveats.append(
            f"Types de séance différents ({label_for(type_a)} vs {label_for(type_b)}) : "
            "le verdict global reste prudent."
        )
    elif not type_a or not type_b:
        caveats.append("Au moins une sortie n’a pas de type de séance : contexte partiel.")

    temp_a = _weather_temp(activity_a)
    temp_b = _weather_temp(activity_b)
    if temp_a is not None and temp_b is not None and abs(temp_b - temp_a) >= TEMP_CAVEAT_C:
        caveats.append(
            f"Écart de température notable ({temp_a:.0f} °C → {temp_b:.0f} °C) : "
            "la FC et l’allure peuvent être influencées par la météo."
        )

    pace_a = _pace_sec_per_km(getattr(activity_a, "average_speed_mps", None))
    pace_b = _pace_sec_per_km(getattr(activity_b, "average_speed_mps", None))
    if pace_a is not None and pace_b is not None:
        pace_dir = direction_lower_better(pace_b, pace_a, stable_pct=STABLE_PACE_PCT)
        if not distances_comparable and pace_dir in ("mieux", "moins_bon"):
            pace_note = "À interpréter avec prudence (distances différentes)."
            # soften to indetermine for overall weighting but keep metric direction with note
        else:
            pace_note = None
        pace_delta = pace_b - pace_a
        pace_metric = _metric(
            key="pace",
            label_fr="Allure",
            value_a=pace_a,
            value_b=pace_b,
            display_a=_format_pace(pace_a),
            display_b=_format_pace(pace_b),
            delta=round(pace_delta, 1),
            delta_display=(
                f"{pace_delta:+.0f} s/km"
                if abs(pace_delta) >= 0.5
                else "≈ stable"
            ),
            direction=pace_dir if distances_comparable else (
                "indetermine" if pace_dir != "stable" else "stable"
            ),
            note_fr=pace_note if not distances_comparable else None,
        )
    else:
        pace_dir = "indetermine"
        pace_metric = None

    hr_a = getattr(activity_a, "average_heartrate", None)
    hr_b = getattr(activity_b, "average_heartrate", None)
    hr_a_f = float(hr_a) if hr_a is not None else None
    hr_b_f = float(hr_b) if hr_b is not None else None
    hr_dir = _direction_hr(hr_a_f, hr_b_f, pace_dir)  # type: ignore[arg-type]
    hr_delta = (hr_b_f - hr_a_f) if hr_a_f is not None and hr_b_f is not None else None
    hr_metric = _metric(
        key="heartrate",
        label_fr="FC moyenne",
        value_a=hr_a_f,
        value_b=hr_b_f,
        display_a=_format_num(hr_a_f, unit=" bpm"),
        display_b=_format_num(hr_b_f, unit=" bpm"),
        delta=round(hr_delta, 1) if hr_delta is not None else None,
        delta_display=(
            f"{hr_delta:+.0f} bpm" if hr_delta is not None else None
        ),
        direction=hr_dir,
        note_fr=(
            "Baisse de FC à allure égale ou meilleure = bonne signal."
            if hr_dir == "mieux"
            else None
        ),
    )

    elev_a = getattr(activity_a, "total_elevation_gain_m", None)
    elev_b = getattr(activity_b, "total_elevation_gain_m", None)
    elev_a_f = float(elev_a) if elev_a is not None else None
    elev_b_f = float(elev_b) if elev_b is not None else None
    # Elevation is context, not strictly better/worse — mark indetermine unless huge gap
    elev_dir: Direction = "indetermine"
    if elev_a_f is not None and elev_b_f is not None:
        if abs(elev_b_f - elev_a_f) < STABLE_ELEV_M:
            elev_dir = "stable"
    elev_metric = _metric(
        key="elevation",
        label_fr="D+",
        value_a=elev_a_f,
        value_b=elev_b_f,
        display_a=_format_num(elev_a_f, unit=" m"),
        display_b=_format_num(elev_b_f, unit=" m"),
        delta=(
            round(elev_b_f - elev_a_f, 1)
            if elev_a_f is not None and elev_b_f is not None
            else None
        ),
        delta_display=(
            f"{elev_b_f - elev_a_f:+.0f} m"
            if elev_a_f is not None and elev_b_f is not None
            else None
        ),
        direction=elev_dir,
        note_fr="Contexte de profil, pas un indicateur de forme isolé.",
    )

    dist_metric = _metric(
        key="distance",
        label_fr="Distance",
        value_a=float(dist_a) if dist_a is not None else None,
        value_b=float(dist_b) if dist_b is not None else None,
        display_a=_format_km(dist_a),
        display_b=_format_km(dist_b),
        delta=(
            round(float(dist_b) - float(dist_a), 1)
            if dist_a is not None and dist_b is not None
            else None
        ),
        delta_display=(
            f"{(float(dist_b) - float(dist_a)) / 1000.0:+.2f} km"
            if dist_a is not None and dist_b is not None
            else None
        ),
        direction="indetermine",
        note_fr=None,
    )

    cad_a = getattr(activity_a, "cadence_ppm", None)
    cad_b = getattr(activity_b, "cadence_ppm", None)
    cad_a_f = float(cad_a) if cad_a is not None else None
    cad_b_f = float(cad_b) if cad_b is not None else None
    cad_metric = _metric(
        key="cadence",
        label_fr="Cadence",
        value_a=cad_a_f,
        value_b=cad_b_f,
        display_a=_format_num(cad_a_f, unit=" PPM"),
        display_b=_format_num(cad_b_f, unit=" PPM"),
        delta=(
            round(cad_b_f - cad_a_f, 1)
            if cad_a_f is not None and cad_b_f is not None
            else None
        ),
        delta_display=(
            f"{cad_b_f - cad_a_f:+.0f} PPM"
            if cad_a_f is not None and cad_b_f is not None
            else None
        ),
        direction=_direction_higher_better(cad_a_f, cad_b_f, stable=STABLE_CADENCE),
    )

    dec_a = _feat_num(activity_a, "decoupling_pct", "decoupling")
    dec_b = _feat_num(activity_b, "decoupling_pct", "decoupling")
    dec_metric = _metric(
        key="decoupling",
        label_fr="Découplage",
        value_a=dec_a,
        value_b=dec_b,
        display_a=_format_num(dec_a, unit=" %", digits=1),
        display_b=_format_num(dec_b, unit=" %", digits=1),
        delta=round(dec_b - dec_a, 2) if dec_a is not None and dec_b is not None else None,
        delta_display=(
            f"{dec_b - dec_a:+.1f} pts"
            if dec_a is not None and dec_b is not None
            else None
        ),
        direction=direction_lower_better(dec_b, dec_a, stable_pct=8.0),
        note_fr="Baisse du découplage = meilleure tenue cardiovasculaire.",
    )

    cv_a = _feat_num(activity_a, "cv_pace")
    cv_b = _feat_num(activity_b, "cv_pace")
    cv_metric = _metric(
        key="cv_pace",
        label_fr="Régularité d’allure",
        value_a=cv_a,
        value_b=cv_b,
        display_a=_format_num(cv_a, digits=3) if cv_a is not None else None,
        display_b=_format_num(cv_b, digits=3) if cv_b is not None else None,
        delta=round(cv_b - cv_a, 4) if cv_a is not None and cv_b is not None else None,
        delta_display=(
            f"{cv_b - cv_a:+.3f}"
            if cv_a is not None and cv_b is not None
            else None
        ),
        direction=direction_lower_better(cv_b, cv_a, stable_pct=10.0),
        note_fr="CV plus bas = allure plus régulière.",
    )

    metrics = [
        m
        for m in (
            pace_metric,
            hr_metric,
            dist_metric,
            elev_metric,
            cad_metric,
            dec_metric,
            cv_metric,
        )
        if m is not None
    ]

    # Overall verdict: weight pace & hr & decoupling when confidence ok
    score = 0
    votes = 0
    if pace_metric and distances_comparable and not types_differ:
        votes += 2
        if pace_metric["direction"] == "mieux":
            score += 2
        elif pace_metric["direction"] == "moins_bon":
            score -= 2
    elif pace_metric and pace_metric["direction"] in ("mieux", "moins_bon"):
        votes += 1
        score += 1 if pace_metric["direction"] == "mieux" else -1

    if hr_metric and hr_metric["direction"] in ("mieux", "moins_bon"):
        votes += 1
        score += 1 if hr_metric["direction"] == "mieux" else -1

    if dec_metric and dec_metric["direction"] in ("mieux", "moins_bon"):
        votes += 1
        score += 1 if dec_metric["direction"] == "mieux" else -1

    if votes == 0:
        overall: Direction = "indetermine"
    elif score >= 2:
        overall = "mieux"
    elif score <= -2:
        overall = "moins_bon"
    elif abs(score) <= 1 and votes >= 1:
        # mostly flat or mixed
        if score > 0:
            overall = "mieux"
        elif score < 0:
            overall = "moins_bon"
        else:
            overall = "stable"
    else:
        overall = "indetermine"

    if types_differ and overall == "mieux":
        overall = "indetermine"
        caveats.append(
            "Pas de verdict « en progrès » global : les types de séance ne sont pas alignés."
        )

    if overall == "mieux":
        headline = "Des signaux d’amélioration"
        summary = (
            f"Sur {label}, la sortie récente montre des signaux favorables "
            "par rapport à la plus ancienne"
        )
        if pace_metric and pace_metric["direction"] == "mieux" and distances_comparable:
            summary += ", notamment sur l’allure"
        summary += "."
    elif overall == "moins_bon":
        headline = "Des signaux en retrait"
        summary = (
            f"Sur {label}, la sortie récente apparaît un peu en retrait "
            "par rapport à la plus ancienne — à remettre dans le contexte charge / météo / type."
        )
    elif overall == "stable":
        headline = "Niveau globalement stable"
        summary = (
            f"Sur {label}, les indicateurs restent proches entre les deux sorties."
        )
    else:
        headline = "Comparaison prudente"
        summary = (
            f"Sur {label}, les données ne permettent pas un verdict net "
            "(contexte, types ou métriques incomplets)."
        )

    return {
        "activity_a": _activity_card(activity_a),
        "activity_b": _activity_card(activity_b),
        "days_between": days,
        "interval_label_fr": label,
        "intro_fr": intro_fr,
        "headline_fr": headline,
        "overall_direction": overall,
        "overall_summary_fr": summary,
        "metrics": metrics,
        "caveats_fr": caveats,
        "distances_comparable": distances_comparable,
        "same_session_type": bool(type_a and type_b and type_a == type_b),
    }


def order_pair(first: Any, second: Any) -> tuple[Any, Any]:
    """Return (older, newer) by start_date; equal dates keep input order by id."""
    d1 = getattr(first, "start_date", None)
    d2 = getattr(second, "start_date", None)
    if d1 is None and d2 is None:
        return (first, second) if first.id <= second.id else (second, first)
    if d1 is None:
        return second, first
    if d2 is None:
        return first, second
    if d1 == d2:
        return (first, second) if first.id <= second.id else (second, first)
    return (first, second) if d1 < d2 else (second, first)

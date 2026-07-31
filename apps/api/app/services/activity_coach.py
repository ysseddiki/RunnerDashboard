"""Analyse coach par activité."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from app.services.session_types import label_for
from app.services.terrains import label_for as terrain_label_for

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.config import Settings
    from app.models import Activity

logger = logging.getLogger("coach.activity")

ANALYSIS_SYSTEM = """Tu es un coach running francophone.
Tu analyses UNE sortie à partir du JSON activité + pack knowledge (analyse-seance.md).
Règles :
- N'invente aucune métrique absente du JSON.
- Si session_type / session_type_label_fr est présent, le type EST connu : ne dis jamais « sans type » ni « taguez le type ».
- Utilise terrain_label_fr quand présent (route, trail, piste…).
- Préfère pace_label (min/km) et distance_km aux m/s bruts.
- Appuie-toi sur features_json (zones FC, decoupling, cv_pace, session) si disponibles.
Réponds UNIQUEMENT JSON :
{"summary":"2–3 phrases","markdown":"## Lecture\\n- ...\\n## Points d'attention\\n- ...","focus":["metric_keys"]}
Adapte le focus au session_type et au terrain.
"""


def _pace_sec_per_km(mps: float | None) -> float | None:
    if mps is None or mps <= 0:
        return None
    return round(1000.0 / mps, 1)


def _fmt_pace(sec: float | None) -> str | None:
    if sec is None:
        return None
    mm = int(sec // 60)
    ss = int(round(sec % 60))
    if ss == 60:
        mm += 1
        ss = 0
    return f"{mm}:{ss:02d}/km"


def _activity_context(activity: Any) -> dict[str, Any]:
    features = activity.features_json if isinstance(activity.features_json, dict) else None
    features_for_coach = None
    if features:
        features_for_coach = {
            k: features.get(k)
            for k in (
                "schema_version",
                "quality_flags",
                "unavailable",
                "time_in_zone",
                "trimp_edwards",
                "decoupling_pct",
                "cv_pace",
                "cv_hr",
                "session",
                "intervals",
            )
            if k in features
        }
        splits = features.get("splits_km")
        if isinstance(splits, list) and splits:
            features_for_coach["splits_km"] = splits[:20]

    pace = _pace_sec_per_km(activity.average_speed_mps)
    return {
        "id": activity.id,
        "name": activity.name,
        "start_date": activity.start_date.isoformat() if activity.start_date else None,
        "distance_m": activity.distance_m,
        "distance_km": round((activity.distance_m or 0) / 1000.0, 2)
        if activity.distance_m
        else None,
        "moving_time_s": activity.moving_time_s,
        "moving_time_min": round((activity.moving_time_s or 0) / 60.0, 1)
        if activity.moving_time_s
        else None,
        "average_speed_mps": activity.average_speed_mps,
        "pace_sec_per_km": pace,
        "pace_label": _fmt_pace(pace),
        "average_heartrate": activity.average_heartrate,
        "max_heartrate": activity.max_heartrate,
        "cadence_ppm": activity.cadence_ppm,
        "total_elevation_gain_m": activity.total_elevation_gain_m,
        "session_type": activity.session_type,
        "session_type_label_fr": label_for(activity.session_type),
        "terrain": activity.terrain,
        "terrain_label_fr": terrain_label_for(activity.terrain),
        "weather_json": activity.weather_json,
        "features_json": features_for_coach,
    }


def insight_hints(
    session_type: str | None,
    terrain: str | None = None,
) -> list[dict[str, str]]:
    """Hints UI déterministes selon type (+ nuance terrain)."""
    st = (session_type or "").strip()
    terrain_note = ""
    if terrain == "trail":
        terrain_note = " Sur trail, l’allure compte moins que l’effort / FC."
    elif terrain == "piste":
        terrain_note = " Sur piste, la régularité des tours est un bon signal."
    elif terrain == "tapis" or terrain == "indoor":
        terrain_note = " En indoor, comparez surtout FC et cadence (PPM)."

    by_type: dict[str, tuple[str, str]] = {
        "ef": (
            "Allure conversationnelle et FC en zones basses (Z1–Z2).",
            "Vérifiez qu’il n’y a pas de dérive inutile vers le tempo.",
        ),
        "recuperation": (
            "Très léger : volume court, FC basse.",
            "Objectif = digérer la charge, pas « bien courir ».",
        ),
        "endurance_active": (
            "Allure un peu plus soutenue que l’EF, encore contrôlée (souvent Z2–Z3).",
            "Gardez une allure stable ; la FC peut monter en Z3 sans viser le seuil.",
        ),
        "sortie_longue": (
            "Volume, dérive cardiaque (decoupling), météo.",
            "Gardez une allure soutenable sur toute la durée.",
        ),
        "tempo": (
            "Régularité d’allure vs cible tempo / spécifique.",
            "Comparez FC moyenne à vos zones Z3–Z4 et le CV d’allure.",
        ),
        "seuil": (
            "Blocs ou continu au seuil : allure et FC en zone cible.",
            "Surveillez la dérive en 2e moitié et la régularité (cv_pace).",
        ),
        "fractionne": (
            "Qualité des intervalles et récupérations.",
            "Cadence et pics d’allure comptent plus que le km total.",
        ),
        "vma": (
            "Répétitions courtes / moyennes autour de la VMA.",
            "Récups complètes : la qualité des reps prime sur le volume.",
        ),
        "cotes": (
            "Effort en montée : puissance / FC, pas l’allure plate.",
            "Descendez en récup ; évitez de forcer en descente.",
        ),
        "fartlek": (
            "Variations d’allure libres : contraste facile / soutenu.",
            "Lisez le temps en zones et la sensation plutôt qu’une cible unique.",
        ),
        "competition": (
            "Perf vs prévisions de distance (ancre course).",
            "Utile pour recalibrer allures et confiance des prévisions.",
        ),
        "test": (
            "Évaluation : chrono / VMA / test — ancre de calibrage.",
            "Comparez au dernier test et aux allures d’entraînement.",
        ),
        "autre": (
            "Métriques globales : distance, allure, FC, terrain.",
            "Précisez le type de séance pour une lecture plus ciblée.",
        ),
    }

    if st in by_type:
        focus, lecture = by_type[st]
        return [
            {"title": "Focus", "text": focus + terrain_note},
            {"title": "Lecture", "text": lecture},
        ]

    return [
        {
            "title": "Focus",
            "text": "Distance, allure, FC — taguez le type de séance pour affiner."
            + terrain_note,
        },
        {
            "title": "Lecture",
            "text": "Sans type de séance, l’analyse reste générique.",
        },
    ]


def refresh_analysis_hints(
    payload: dict[str, Any] | None, activity: Any
) -> dict[str, Any] | None:
    """Recalcule Focus/Lecture selon le type/terrain actuels (sans relancer le LLM)."""
    if not isinstance(payload, dict):
        return payload
    return {
        **payload,
        "hints": insight_hints(activity.session_type, activity.terrain),
        "session_type": activity.session_type,
        "terrain": activity.terrain,
    }


def analyze_activity(
    db: Session, env: Settings, user_id: int, activity_id: int
) -> dict[str, Any]:
    from app.models import Activity
    from app.services import knowledge
    from app.services import settings as settings_service
    from app.services.coach import parse_coach_answer
    from app.services.ollama_client import OllamaClient, OllamaError

    activity = db.get(Activity, activity_id)
    if activity is None:
        raise ValueError(f"Activité {activity_id} introuvable")
    if activity.user_id != user_id:
        raise ValueError(f"Activité {activity_id} introuvable")

    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable():
        raise OllamaError("Ollama injoignable")
    if not client.model_installed(model):
        raise OllamaError(f"Modèle {model} non installé")

    pack = knowledge.load_pack(max_chars=8000)
    ctx = _activity_context(activity)
    raw = client.chat(
        model=model,
        system=ANALYSIS_SYSTEM,
        user=(
            f"Pack knowledge :\n{pack}\n\n"
            f"Activité JSON :\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
            "Analyse cette sortie en t’appuyant sur session_type_label_fr, "
            "terrain_label_fr, pace_label et features_json."
        ),
        timeout_s=env.ollama_chat_timeout_s,
        num_predict=min(env.ollama_num_predict, 700),
        keep_alive=env.ollama_keep_alive,
        num_thread=settings_service.get_resolved_ollama_num_thread(db, env),
    )
    parsed = parse_coach_answer(raw)
    payload = {
        "model": model,
        "summary": parsed["summary"],
        "markdown": parsed["markdown"],
        "hints": insight_hints(activity.session_type, activity.terrain),
        "session_type": activity.session_type,
        "terrain": activity.terrain,
    }
    activity.coach_analysis_json = payload
    activity.coach_analyzed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(activity)
    logger.info("Analyse activité OK | id=%s | model=%s", activity_id, model)
    return payload


def analyze_missing(
    db: Session, env: Settings, user_id: int, *, limit: int = 3
) -> int:
    from sqlalchemy import select

    from app.models import Activity

    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.user_id == user_id)
            .where(Activity.coach_analysis_json.is_(None))
            .order_by(Activity.start_date.desc())
            .limit(limit)
        ).all()
    )
    done = 0
    for activity in rows:
        try:
            analyze_activity(db, env, user_id, activity.id)
            done += 1
        except Exception:
            logger.exception("Échec analyse activité | id=%s", activity.id)
    return done

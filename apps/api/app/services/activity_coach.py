"""Analyse coach par activité."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Activity
from app.services import knowledge
from app.services import settings as settings_service
from app.services.coach import parse_coach_answer
from app.services.ollama_client import OllamaClient, OllamaError
from app.services.session_types import label_for

logger = logging.getLogger("coach.activity")

ANALYSIS_SYSTEM = """Tu es un coach running francophone.
Tu analyses UNE sortie à partir du JSON activité + pack knowledge (analyse-seance.md).
N'invente aucune métrique absente. Réponds UNIQUEMENT JSON :
{"summary":"2–3 phrases","markdown":"## Lecture\\n- ...\\n## Points d'attention\\n- ...","focus":["metric_keys"]}
Adapte le focus au session_type (ef vs fractionne vs competition…).
"""


def _activity_context(activity: Activity) -> dict[str, Any]:
    return {
        "id": activity.id,
        "name": activity.name,
        "start_date": activity.start_date.isoformat() if activity.start_date else None,
        "distance_m": activity.distance_m,
        "moving_time_s": activity.moving_time_s,
        "average_speed_mps": activity.average_speed_mps,
        "average_heartrate": activity.average_heartrate,
        "max_heartrate": activity.max_heartrate,
        "cadence_ppm": activity.cadence_ppm,
        "total_elevation_gain_m": activity.total_elevation_gain_m,
        "session_type": activity.session_type,
        "session_type_label_fr": label_for(activity.session_type),
        "weather_json": activity.weather_json,
    }


def insight_hints(session_type: str | None) -> list[dict[str, str]]:
    """Hints UI déterministes selon type (complètent l’analyse IA)."""
    st = session_type or ""
    if st in {"ef", "recuperation"}:
        return [
            {"title": "Focus", "text": "Allure conversationnelle et FC en zones basses."},
            {"title": "Lecture", "text": "Vérifiez qu’il n’y a pas de dérive inutile vers le tempo."},
        ]
    if st in {"tempo", "seuil"}:
        return [
            {"title": "Focus", "text": "Régularité d’allure vs cible prévisions seuil/tempo."},
            {"title": "Lecture", "text": "Comparez FC moyenne à vos zones Z3–Z4."},
        ]
    if st in {"fractionne", "vma"}:
        return [
            {"title": "Focus", "text": "Qualité des intervalles et récupérations."},
            {"title": "Lecture", "text": "Cadence et pics d’allure comptent plus que le km total."},
        ]
    if st == "sortie_longue":
        return [
            {"title": "Focus", "text": "Volume, dérive cardiaque, météo."},
            {"title": "Lecture", "text": "Gardez une allure soutenable sur toute la durée."},
        ]
    if st in {"competition", "test"}:
        return [
            {"title": "Focus", "text": "Perf vs prévisions de distance."},
            {"title": "Lecture", "text": "Utile comme ancre pour recalibrer les allures."},
        ]
    return [
        {"title": "Focus", "text": "Distance, allure, FC — taguez le type pour affiner."},
        {"title": "Lecture", "text": "Sans type de séance, l’analyse reste générique."},
    ]


def analyze_activity(db: Session, env: Settings, activity_id: int) -> dict[str, Any]:
    activity = db.get(Activity, activity_id)
    if activity is None:
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
            "Analyse cette sortie."
        ),
        timeout_s=env.ollama_chat_timeout_s,
        num_predict=min(env.ollama_num_predict, 700),
        keep_alive=env.ollama_keep_alive,
    )
    parsed = parse_coach_answer(raw)
    payload = {
        "model": model,
        "summary": parsed["summary"],
        "markdown": parsed["markdown"],
        "hints": insight_hints(activity.session_type),
        "session_type": activity.session_type,
    }
    activity.coach_analysis_json = payload
    activity.coach_analyzed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(activity)
    logger.info("Analyse activité OK | id=%s | model=%s", activity_id, model)
    return payload


def analyze_missing(db: Session, env: Settings, *, limit: int = 3) -> int:
    rows = list(
        db.scalars(
            select(Activity)
            .where(Activity.coach_analysis_json.is_(None))
            .order_by(Activity.start_date.desc())
            .limit(limit)
        ).all()
    )
    done = 0
    for activity in rows:
        try:
            analyze_activity(db, env, activity.id)
            done += 1
        except Exception:
            logger.exception("Échec analyse activité | id=%s", activity.id)
    return done

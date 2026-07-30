"""Suggestion automatique de type de séance (règles + IA locale optionnelle)."""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Activity
from app.services import settings as settings_service
from app.services.ollama_client import OllamaClient, OllamaError
from app.services.predictions import (
    TRAINING_FACTORS,
    _pace_sec_per_km,
    build_predictions_overview,
)
from app.services.session_types import SESSION_TYPE_IDS, label_for

logger = logging.getLogger("session_type_suggest")

Confidence = Literal["haute", "moyenne", "basse"]

NAME_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("competition", ("compétition", "competition", "course officielle", "10 km course", "semi-marathon", "marathon")),
    ("test", ("test vma", "cooper", "évaluation", "chrono test", "test ")),
    ("vma", ("vma", "30/30", "200 m", "300 m")),
    ("fractionne", ("fractionné", "fractionne", "intervalles", "1000 m", "400 m", "800 m")),
    ("seuil", ("seuil", "tempo seuil")),
    ("tempo", ("tempo", "allure spécifique", "allure semi")),
    ("cotes", ("côte", "cote", "hill", "montée", "montees")),
    ("fartlek", ("fartlek",)),
    ("sortie_longue", ("sortie longue", "long run", "lsl", "sortie long")),
    ("recuperation", ("récup", "recup", "recovery", "footing récup")),
    ("ef", ("ef ", "endurance fondamentale", "footing", "easy run")),
)


def _pace_10k_from_overview(overview: dict[str, Any]) -> float | None:
    for est in overview.get("estimates") or []:
        if est.get("id") == "10k" and est.get("pace_sec_per_km"):
            return float(est["pace_sec_per_km"])
    return None


def _match_name(name: str) -> tuple[str, Confidence, str] | None:
    lower = name.lower()
    for type_id, words in NAME_KEYWORDS:
        for word in words:
            if word in lower:
                return (
                    type_id,
                    "haute",
                    f"Mot-clé « {word} » dans le titre Strava.",
                )
    return None


def _rules_suggest(activity: Activity, pace_10k: float | None) -> dict[str, Any]:
    name_hit = _match_name(activity.name or "")
    if name_hit:
        type_id, conf, rationale = name_hit
        return {
            "suggested_session_type": type_id,
            "confidence": conf,
            "source": "rules",
            "rationale_fr": rationale,
            "label_fr": label_for(type_id),
        }

    km = (activity.distance_m or 0) / 1000.0
    elev = activity.total_elevation_gain_m or 0.0
    pace = _pace_sec_per_km(activity.average_speed_mps)
    elev_per_km = elev / km if km > 0 else 0.0

    if km >= 2 and elev_per_km >= 45:
        return {
            "suggested_session_type": "cotes",
            "confidence": "moyenne",
            "source": "rules",
            "rationale_fr": f"D+ élevé (~{elev_per_km:.0f} m/km) pour {km:.1f} km.",
            "label_fr": label_for("cotes"),
        }

    if km >= 16 and (pace is None or pace_10k is None or pace >= pace_10k * 1.08):
        return {
            "suggested_session_type": "sortie_longue",
            "confidence": "moyenne",
            "source": "rules",
            "rationale_fr": f"Volume long ({km:.1f} km) à allure plutôt contrôlée.",
            "label_fr": label_for("sortie_longue"),
        }

    if pace is None or pace_10k is None:
        return {
            "suggested_session_type": "ef" if km >= 5 else "autre",
            "confidence": "basse",
            "source": "rules",
            "rationale_fr": "Allure ou prévision 10 km insuffisante — suggestion prudente.",
            "label_fr": label_for("ef" if km >= 5 else "autre"),
        }

    ratio = pace / pace_10k
    # Plus le ratio est bas, plus l'allure est rapide vs 10k estimé.
    candidates: list[tuple[str, float]] = []
    for type_id, factor in TRAINING_FACTORS.items():
        if type_id in {"competition", "test", "autre", "cotes", "fartlek"}:
            continue
        candidates.append((type_id, abs(ratio - factor)))
    candidates.sort(key=lambda x: x[1])
    best_id, delta = candidates[0]

    hr = activity.average_heartrate
    max_hr = activity.max_heartrate
    if hr and max_hr and max_hr > 0:
        hr_ratio = hr / max_hr
        if hr_ratio < 0.72 and ratio >= 1.15:
            best_id = "recuperation" if km < 8 else "ef"
            delta = 0.02
        elif hr_ratio > 0.88 and ratio < 1.0:
            if best_id not in {"fractionne", "vma", "seuil", "tempo"}:
                best_id = "seuil"

    if delta <= 0.04:
        conf: Confidence = "haute"
    elif delta <= 0.08:
        conf = "moyenne"
    else:
        conf = "basse"

    rationale = (
        f"Allure {pace / 60:.0f}:{int(pace % 60):02d}/km vs 10 km estimé "
        f"({pace_10k / 60:.0f}:{int(pace_10k % 60):02d}/km) → ratio {ratio:.2f} "
        f"proche du facteur « {label_for(best_id)} » ({TRAINING_FACTORS.get(best_id, 1):.2f})."
    )
    return {
        "suggested_session_type": best_id,
        "confidence": conf,
        "source": "rules",
        "rationale_fr": rationale,
        "label_fr": label_for(best_id),
    }


def _ai_refine(
    activity: Activity,
    rules: dict[str, Any],
    env: Settings,
    db: Session,
) -> dict[str, Any] | None:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable() or not client.model_installed(model):
        return None

    payload = {
        "name": activity.name,
        "distance_km": round((activity.distance_m or 0) / 1000.0, 2),
        "pace_sec_per_km": _pace_sec_per_km(activity.average_speed_mps),
        "elevation_m": activity.total_elevation_gain_m,
        "avg_hr": activity.average_heartrate,
        "max_hr": activity.max_heartrate,
        "rules_suggestion": rules["suggested_session_type"],
        "allowed_ids": sorted(SESSION_TYPE_IDS),
    }
    system = (
        "Tu classes une sortie running. Réponds UNIQUEMENT JSON : "
        '{"session_type":"<id>","confidence":"haute|moyenne|basse","rationale_fr":"..."} '
        "session_type doit être dans allowed_ids."
    )
    try:
        raw = client.chat(
            model=model,
            system=system,
            user=json.dumps(payload, ensure_ascii=False),
            timeout_s=min(120.0, env.ollama_chat_timeout_s),
            num_predict=min(256, env.ollama_num_predict),
            keep_alive=env.ollama_keep_alive,
        )
    except OllamaError as exc:
        logger.warning("Suggestion IA échouée | detail=%s", exc)
        return None

    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
    st = str(data.get("session_type") or "").strip()
    if st not in SESSION_TYPE_IDS:
        return None
    conf = str(data.get("confidence") or "moyenne")
    if conf not in ("haute", "moyenne", "basse"):
        conf = "moyenne"
    rationale = str(data.get("rationale_fr") or "Affinage IA local.").strip()[:400]
    return {
        "suggested_session_type": st,
        "confidence": conf,
        "source": "ai",
        "rationale_fr": rationale,
        "label_fr": label_for(st),
    }


def suggest_for_activity(
    db: Session,
    user_id: int,
    activity: Activity,
    *,
    env: Settings | None = None,
    use_ai: bool = False,
) -> dict[str, Any]:
    overview = build_predictions_overview(db, user_id)
    pace_10k = None
    if overview.get("available"):
        pace_10k = _pace_10k_from_overview(overview)

    rules = _rules_suggest(activity, pace_10k)
    result = rules
    if use_ai and env is not None:
        refined = _ai_refine(activity, rules, env, db)
        if refined:
            result = refined

    return {
        "activity_id": activity.id,
        "current_session_type": activity.session_type,
        **result,
    }


def suggest_batch(
    db: Session,
    user_id: int,
    *,
    env: Settings | None = None,
    use_ai: bool = False,
    untagged_only: bool = True,
    limit: int = 20,
) -> dict[str, Any]:
    stmt = (
        select(Activity)
        .where(Activity.user_id == user_id)
        .order_by(Activity.start_date.desc().nullslast())
        .limit(200)
    )
    rows = list(db.scalars(stmt).all())
    if untagged_only:
        rows = [a for a in rows if not a.session_type]
    rows = rows[: max(1, min(limit, 50))]

    # Précharger overview une fois
    overview = build_predictions_overview(db, user_id)
    pace_10k = _pace_10k_from_overview(overview) if overview.get("available") else None

    suggestions = []
    for activity in rows:
        rules = _rules_suggest(activity, pace_10k)
        result = rules
        if use_ai and env is not None:
            refined = _ai_refine(activity, rules, env, db)
            if refined:
                result = refined
        suggestions.append(
            {
                "activity_id": activity.id,
                "name": activity.name,
                "current_session_type": activity.session_type,
                **result,
            }
        )
    return {"count": len(suggestions), "suggestions": suggestions}

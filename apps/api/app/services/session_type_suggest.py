"""Suggestion de type de séance — scoring multi-signaux (profil, features, allure, titre)."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Activity
from app.services import athlete_profile as profile_service
from app.services import settings as settings_service
from app.services.ollama_client import OllamaClient, OllamaError
from app.services.predictions import (
    TRAINING_FACTORS,
    _pace_sec_per_km,
    build_predictions_overview,
)
from app.services.session_types import SESSION_TYPE_IDS, label_for
from app.services.terrains import is_roadish

logger = logging.getLogger("session_type_suggest")

Confidence = Literal["haute", "moyenne", "basse"]
CONF_RANK = {"basse": 0, "moyenne": 1, "haute": 2}

NAME_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "competition",
        (
            "compétition",
            "competition",
            "course officielle",
            "10k official",
            "semi-marathon",
            "semi marathon",
            "marathon",
            "championnat",
            "race day",
        ),
    ),
    ("test", ("test vma", "cooper", "évaluation", "chrono test", "test ", "bilan")),
    ("vma", ("vma", "30/30", "200 m", "300 m", "15/15", "20/20")),
    (
        "fractionne",
        (
            "fractionné",
            "fractionne",
            "intervalles",
            "interval",
            "1000 m",
            "400 m",
            "800 m",
            "pyramide",
            "séries",
        ),
    ),
    ("seuil", ("seuil", "tempo seuil", "threshold")),
    ("tempo", ("tempo", "allure spécifique", "allure semi", "cruise")),
    ("cotes", ("côte", "cote", "hill", "montée", "montees", "hills", "repeats")),
    ("fartlek", ("fartlek",)),
    ("sortie_longue", ("sortie longue", "long run", "lsl", "sortie long", "longue")),
    ("recuperation", ("récup", "recup", "recovery", "footing récup", "active recovery")),
    ("ef", ("ef ", "endurance fondamentale", "footing", "easy run", "easy ", "z2")),
    ("endurance_active", ("endurance active", "ea ", "steady")),
)


def _pace_10k_from_overview(overview: dict[str, Any]) -> float | None:
    for est in overview.get("estimates") or []:
        if est.get("id") == "10k" and est.get("pace_sec_per_km"):
            return float(est["pace_sec_per_km"])
    return None


def _match_name(name: str) -> list[tuple[str, float, str]]:
    lower = name.lower()
    hits: list[tuple[str, float, str]] = []
    for type_id, words in NAME_KEYWORDS:
        for word in words:
            if word in lower:
                hits.append((type_id, 9.0, f"Titre : « {word} »"))
                break
    return hits


def _zone_for_hr(hr: float, zones: list[dict[str, Any]]) -> str | None:
    for z in zones:
        lo = z.get("hr_low")
        hi = z.get("hr_high")
        zid = z.get("id")
        if lo is None or hi is None or not zid:
            continue
        if float(lo) <= hr <= float(hi):
            return str(zid)
    return None


def _pct_zones(time_in_zone: dict[str, Any] | None) -> dict[str, float]:
    if not time_in_zone:
        return {}
    return {
        zid: float((payload or {}).get("pct") or 0)
        for zid, payload in time_in_zone.items()
        if isinstance(payload, dict)
    }


def _features_blob(activity: Activity) -> dict[str, Any]:
    raw = activity.features_json
    return raw if isinstance(raw, dict) else {}


def _score_activity(
    activity: Activity,
    *,
    pace_10k: float | None,
    zones_payload: dict[str, Any],
) -> dict[str, Any]:
    scores: dict[str, float] = defaultdict(float)
    reasons: list[str] = []

    def bump(type_id: str, pts: float, why: str) -> None:
        if type_id not in SESSION_TYPE_IDS:
            return
        scores[type_id] += pts
        if why and why not in reasons:
            reasons.append(why)

    for type_id, pts, why in _match_name(activity.name or ""):
        bump(type_id, pts, why)

    km = (activity.distance_m or 0) / 1000.0
    elev = float(activity.total_elevation_gain_m or 0.0)
    elev_per_km = elev / km if km > 0 else 0.0
    pace = _pace_sec_per_km(activity.average_speed_mps)
    moving_s = float(activity.moving_time_s or activity.elapsed_time_s or 0)
    moving_min = moving_s / 60.0 if moving_s > 0 else 0.0
    avg_hr = activity.average_heartrate
    max_hr_act = activity.max_heartrate
    feat = _features_blob(activity)
    intervals = feat.get("intervals") if isinstance(feat.get("intervals"), dict) else None
    cv_pace = feat.get("cv_pace")
    if isinstance(cv_pace, (int, float)):
        cv_pace_f = float(cv_pace)
    else:
        cv_pace_f = None
    tiz = feat.get("time_in_zone") if isinstance(feat.get("time_in_zone"), dict) else None
    pct = _pct_zones(tiz)
    z12 = pct.get("Z1", 0) + pct.get("Z2", 0)
    z3 = pct.get("Z3", 0)
    z45 = pct.get("Z4", 0) + pct.get("Z5", 0)

    zones_list = zones_payload.get("zones") if zones_payload.get("available") else None
    profile_zone = None
    if avg_hr and isinstance(zones_list, list) and zones_list:
        profile_zone = _zone_for_hr(float(avg_hr), zones_list)

    # —— Dénivelé / côtes (type séance ≠ terrain trail)
    if km >= 2 and elev_per_km >= 55:
        bump("cotes", 6.5, f"D+ fort (~{elev_per_km:.0f} m/km)")
    elif km >= 3 and elev_per_km >= 35:
        bump("cotes", 3.5, f"D+ marqué (~{elev_per_km:.0f} m/km)")

    # —— Intervalles détectés dans les streams
    if intervals and (intervals.get("count") or 0) >= 2:
        count = int(intervals["count"])
        conf = str(intervals.get("confidence") or "basse")
        reps = intervals.get("reps") or []
        work_reps = [r for r in reps if isinstance(r, dict) and r.get("kind") == "work"]
        avg_work_s = 0.0
        if work_reps:
            avg_work_s = sum(float(r.get("duration_s") or 0) for r in work_reps) / len(
                work_reps
            )
        base = 5.0 if conf == "haute" else 3.5 if conf == "moyenne" else 2.0
        base += min(3.0, count * 0.4)
        if avg_work_s and avg_work_s <= 75:
            bump("vma", base + 1.5, f"Intervalles courts détectés ({count} blocs)")
            bump("fractionne", base * 0.6, "")
        elif avg_work_s and avg_work_s <= 180:
            bump("fractionne", base + 1.5, f"Intervalles détectés ({count} blocs)")
            bump("vma", base * 0.5, "")
        else:
            bump("fractionne", base, f"Blocs d’effort répétés ({count})")
            bump("seuil", base * 0.4, "")
        if elev_per_km >= 40:
            bump("cotes", 2.5, "Intervalles + dénivelé → côtes possibles")

    # —— Régularité d’allure (continu vs haché)
    if cv_pace_f is not None:
        if cv_pace_f < 0.05 and pace is not None and pace_10k is not None:
            ratio = pace / pace_10k
            if 0.98 <= ratio <= 1.08:
                bump("tempo", 4.0, "Allure très régulière proche du 10 km")
                bump("seuil", 3.2, "")
            elif 1.08 < ratio <= 1.16:
                bump("endurance_active", 3.5, "Allure régulière un peu sous le 10 km")
                bump("tempo", 2.0, "")
        elif cv_pace_f > 0.14 and not (intervals and (intervals.get("count") or 0) >= 2):
            bump("fartlek", 2.5, "Allure très variable (sans intervalles clairs)")

    # —— Temps dans les zones (features + profil)
    if z12 >= 70 and z45 < 15:
        bump("ef", 5.0, f"Majorité Z1–Z2 ({z12:.0f} %)")
        bump("recuperation", 2.5 if km < 10 else 1.0, "")
        bump("sortie_longue", 2.0 if km >= 14 else 0.0, "")
    if z3 >= 35 and z45 < 25:
        bump("endurance_active", 3.5, f"Temps significatif en Z3 ({z3:.0f} %)")
        bump("tempo", 2.5, "")
    if z45 >= 25:
        bump("seuil", 4.5, f"Temps élevé Z4–Z5 ({z45:.0f} %)")
        bump("tempo", 2.5, "")
        bump("fractionne", 2.0, "")
        bump("vma", 1.5, "")
    if z45 >= 40 and moving_min < 50:
        bump("vma", 3.0, "Effort court très intense (Z4–Z5)")
        bump("test", 1.5, "")

    if profile_zone == "Z1":
        bump("recuperation", 3.5, "FC moyenne en Z1 (profil)")
        bump("ef", 2.0, "")
    elif profile_zone == "Z2":
        bump("ef", 4.0, "FC moyenne en Z2 (profil)")
        bump("sortie_longue", 1.5 if km >= 14 else 0.0, "")
    elif profile_zone == "Z3":
        bump("endurance_active", 3.5, "FC moyenne en Z3 (profil)")
        bump("tempo", 2.5, "")
    elif profile_zone == "Z4":
        bump("seuil", 4.0, "FC moyenne en Z4 (profil)")
        bump("tempo", 3.0, "")
    elif profile_zone == "Z5":
        bump("vma", 3.5, "FC moyenne en Z5 (profil)")
        bump("fractionne", 3.0, "")
        bump("competition", 1.5 if is_roadish(activity.terrain) else 0.5, "")

    # Fallback HR vs max activité si pas de zones profil
    if profile_zone is None and avg_hr and max_hr_act and max_hr_act > 0:
        hr_ratio = float(avg_hr) / float(max_hr_act)
        if hr_ratio < 0.70:
            bump("recuperation" if km < 9 else "ef", 2.5, "FC basse vs FC max séance")
        elif hr_ratio > 0.90:
            bump("seuil", 2.0, "FC haute vs FC max séance")
            bump("competition", 1.0, "")

    # —— Volume / durée
    if km >= 18 or moving_min >= 100:
        easyish = (
            (pace is None or pace_10k is None or pace >= pace_10k * 1.08)
            and (profile_zone in {None, "Z1", "Z2"} or z12 >= 55 or z45 < 20)
        )
        if easyish:
            bump("sortie_longue", 6.0, f"Volume long ({km:.1f} km / {moving_min:.0f} min)")
            bump("ef", 1.5, "")
        else:
            bump("sortie_longue", 3.0, f"Longue sortie ({km:.1f} km) plus soutenue")
            bump("tempo", 1.5, "")
    elif km >= 14:
        bump("sortie_longue", 3.0, f"Distance élevée ({km:.1f} km)")

    if km < 4 and moving_min < 25 and pace is not None and pace_10k is not None:
        if pace < pace_10k * 0.98:
            bump("vma", 2.0, "Sortie courte et rapide")
            bump("test", 1.5, "")

    # —— Allure vs 10 km estimé (facteurs d’entraînement)
    if pace is not None and pace_10k is not None and pace_10k > 0:
        ratio = pace / pace_10k
        for type_id, factor in TRAINING_FACTORS.items():
            if type_id in {"competition", "test", "autre", "cotes", "fartlek"}:
                continue
            delta = abs(ratio - factor)
            # Score décroissant avec l’écart
            pts = max(0.0, 4.5 - delta * 28.0)
            if pts >= 1.0:
                bump(
                    type_id,
                    pts,
                    f"Ratio allure/10k {ratio:.2f} proche de {label_for(type_id)} ({factor:.2f})"
                    if pts >= 3.0
                    else "",
                )
        # Course / test : allure ≥ 10k, distance « ronde », régulière
        if ratio <= 1.03 and 4.5 <= km <= 45 and (cv_pace_f is None or cv_pace_f < 0.08):
            bump("competition", 2.5, "Allure compétition plausible vs 10 km")
            bump("test", 1.5, "")

    # Terrain trail : moins compétition route, plus sortie longue / côtes
    if activity.terrain == "trail":
        bump("competition", -2.0, "")
        bump("sortie_longue", 1.0, "")
        if elev_per_km >= 25:
            bump("cotes", 1.0, "")
    if activity.terrain == "piste":
        bump("fractionne", 1.5, "Terrain piste")
        bump("vma", 1.5, "")
        bump("test", 1.0, "")

    if not scores:
        fallback = "ef" if km >= 5 else "autre"
        bump(fallback, 1.0, "Peu de signaux — suggestion prudente")

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_id, best_score = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    margin = best_score - second

    if best_score >= 10 and margin >= 2.5:
        conf: Confidence = "haute"
    elif best_score >= 6 and margin >= 1.0:
        conf = "moyenne"
    else:
        conf = "basse"

    clean_reasons = [r for r in reasons if r][:4]
    if not clean_reasons:
        clean_reasons = [f"Score dominant pour « {label_for(best_id)} » ({best_score:.1f})."]

    return {
        "suggested_session_type": best_id,
        "confidence": conf,
        "source": "rules",
        "rationale_fr": " · ".join(clean_reasons),
        "label_fr": label_for(best_id),
        "score": round(best_score, 2),
        "runners_up": [
            {"session_type": tid, "label_fr": label_for(tid), "score": round(sc, 2)}
            for tid, sc in ranked[1:4]
            if sc > 0
        ],
    }


def _ai_refine(
    activity: Activity,
    rules: dict[str, Any],
    env: Settings,
    db: Session,
    *,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable() or not client.model_installed(model):
        return None

    feat = _features_blob(activity)
    payload = {
        "name": activity.name,
        "distance_km": round((activity.distance_m or 0) / 1000.0, 2),
        "pace_sec_per_km": _pace_sec_per_km(activity.average_speed_mps),
        "elevation_m": activity.total_elevation_gain_m,
        "avg_hr": activity.average_heartrate,
        "max_hr": activity.max_heartrate,
        "terrain": activity.terrain,
        "rules_suggestion": rules["suggested_session_type"],
        "rules_rationale": rules.get("rationale_fr"),
        "runners_up": rules.get("runners_up"),
        "features": {
            "cv_pace": feat.get("cv_pace"),
            "time_in_zone": feat.get("time_in_zone"),
            "intervals": feat.get("intervals"),
            "trimp_edwards": feat.get("trimp_edwards"),
        },
        "profile": {
            "age": (profile or {}).get("age"),
            "max_hr": (profile or {}).get("max_hr"),
            "resting_hr": (profile or {}).get("resting_hr"),
            "zones_available": bool(((profile or {}).get("zones") or {}).get("available")),
            "goal_text": (profile or {}).get("goal_text"),
        },
        "allowed_ids": sorted(SESSION_TYPE_IDS),
    }
    system = (
        "Tu classes une sortie running francophone. "
        "Prends en compte allure, FC/zones, intervalles, D+, terrain et profil. "
        "Réponds UNIQUEMENT JSON : "
        '{"session_type":"<id>","confidence":"haute|moyenne|basse","rationale_fr":"..."} '
        "session_type doit être dans allowed_ids. "
        "Ne confonds pas trail (terrain) avec un type de séance."
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
        "score": rules.get("score"),
        "runners_up": rules.get("runners_up"),
    }


def _context(db: Session, user_id: int) -> tuple[float | None, dict[str, Any], dict[str, Any]]:
    overview = build_predictions_overview(db, user_id)
    pace_10k = _pace_10k_from_overview(overview) if overview.get("available") else None
    profile = profile_service.profile_payload(db, user_id)
    zones = profile.get("zones") if isinstance(profile.get("zones"), dict) else {
        "available": False,
        "zones": [],
    }
    return pace_10k, zones, profile


def suggest_for_activity(
    db: Session,
    user_id: int,
    activity: Activity,
    *,
    env: Settings | None = None,
    use_ai: bool = False,
) -> dict[str, Any]:
    pace_10k, zones, profile = _context(db, user_id)
    rules = _score_activity(activity, pace_10k=pace_10k, zones_payload=zones)
    result = rules
    if use_ai and env is not None:
        refined = _ai_refine(activity, rules, env, db, profile=profile)
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
    limit: int = 50,
    activity_ids: list[int] | None = None,
) -> dict[str, Any]:
    stmt = (
        select(Activity)
        .where(Activity.user_id == user_id)
        .order_by(Activity.start_date.desc().nullslast())
        .limit(300)
    )
    rows = list(db.scalars(stmt).all())
    if activity_ids is not None:
        wanted = set(activity_ids)
        rows = [a for a in rows if a.id in wanted]
    if untagged_only:
        rows = [a for a in rows if not a.session_type]
    rows = rows[: max(1, min(limit, 100))]

    pace_10k, zones, profile = _context(db, user_id)

    suggestions = []
    for activity in rows:
        rules = _score_activity(activity, pace_10k=pace_10k, zones_payload=zones)
        result = rules
        if use_ai and env is not None:
            refined = _ai_refine(activity, rules, env, db, profile=profile)
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


def apply_suggestions(
    db: Session,
    user_id: int,
    *,
    env: Settings | None = None,
    use_ai: bool = False,
    untagged_only: bool = True,
    limit: int = 50,
    min_confidence: Confidence = "basse",
    activity_ids: list[int] | None = None,
) -> dict[str, Any]:
    batch = suggest_batch(
        db,
        user_id,
        env=env,
        use_ai=use_ai,
        untagged_only=untagged_only,
        limit=limit,
        activity_ids=activity_ids,
    )
    min_rank = CONF_RANK[min_confidence]
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    id_map = {
        a.id: a
        for a in db.scalars(
            select(Activity).where(Activity.user_id == user_id)
        ).all()
    }

    from app.services import activity_features as features_service

    for sug in batch["suggestions"]:
        conf = str(sug.get("confidence") or "basse")
        if CONF_RANK.get(conf, 0) < min_rank:
            skipped.append({**sug, "skip_reason": "confiance insuffisante"})
            continue
        activity = id_map.get(int(sug["activity_id"]))
        if activity is None:
            skipped.append({**sug, "skip_reason": "introuvable"})
            continue
        if untagged_only and activity.session_type:
            skipped.append({**sug, "skip_reason": "déjà classé"})
            continue
        st = sug["suggested_session_type"]
        if st not in SESSION_TYPE_IDS:
            skipped.append({**sug, "skip_reason": "type invalide"})
            continue
        activity.session_type = st
        features_service.apply_features(db, activity, force=True)
        applied.append(
            {
                "activity_id": activity.id,
                "session_type": st,
                "label_fr": label_for(st),
                "confidence": conf,
                "rationale_fr": sug.get("rationale_fr"),
            }
        )

    db.commit()
    return {
        "applied_count": len(applied),
        "skipped_count": len(skipped),
        "applied": applied,
        "skipped": skipped,
        "message": (
            f"{len(applied)} type(s) appliqué(s)"
            + (f", {len(skipped)} ignoré(s)." if skipped else ".")
        ),
    }


def bulk_update(
    db: Session,
    user_id: int,
    activity_ids: list[int],
    *,
    session_type: str | None = None,
    terrain: str | None = None,
    clear_session_type: bool = False,
    clear_terrain: bool = False,
) -> dict[str, Any]:
    from app.services.terrains import TERRAIN_IDS, label_for as terrain_label
    from app.services import activity_features as features_service

    if not activity_ids:
        return {"updated": 0, "message": "Aucune activité sélectionnée."}

    if session_type is not None and session_type not in SESSION_TYPE_IDS:
        raise ValueError(f"Type de séance invalide : {session_type}")
    if terrain is not None and terrain not in TERRAIN_IDS:
        raise ValueError(f"Terrain invalide : {terrain}")

    rows = list(
        db.scalars(
            select(Activity).where(
                Activity.user_id == user_id, Activity.id.in_(activity_ids)
            )
        ).all()
    )
    updated = 0
    for activity in rows:
        changed = False
        if clear_session_type:
            if activity.session_type is not None:
                activity.session_type = None
                changed = True
        elif session_type is not None:
            activity.session_type = session_type
            changed = True
        if clear_terrain:
            if activity.terrain is not None:
                activity.terrain = None
                changed = True
        elif terrain is not None:
            activity.terrain = terrain
            changed = True
        if changed:
            features_service.apply_features(db, activity, force=True)
            updated += 1

    db.commit()
    bits: list[str] = []
    if clear_session_type:
        bits.append("types effacés")
    elif session_type is not None:
        bits.append(f"type → {label_for(session_type)}")
    if clear_terrain:
        bits.append("terrains effacés")
    elif terrain is not None:
        bits.append(f"terrain → {terrain_label(terrain)}")
    detail = ", ".join(bits) if bits else "aucun champ"
    return {
        "updated": updated,
        "session_type": None if clear_session_type else session_type,
        "session_type_label_fr": None
        if clear_session_type or session_type is None
        else label_for(session_type),
        "terrain": None if clear_terrain else terrain,
        "terrain_label_fr": None
        if clear_terrain or terrain is None
        else terrain_label(terrain),
        "message": f"{updated} activité(s) mise(s) à jour ({detail}).",
    }

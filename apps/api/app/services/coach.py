"""Orchestration coach IA local (Ollama) — réponse structurée v2."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.services import knowledge
from app.services import settings as settings_service
from app.services.coach_context import build_coach_context
from app.services.ollama_client import OllamaClient, OllamaError
from app.services.session_types import SESSION_TYPE_IDS, label_for

logger = logging.getLogger("coach")

SYSTEM_PROMPT = """Tu es un coach running francophone, précis et prudent.
Tu travailles UNIQUEMENT avec le JSON de contexte fourni et le pack knowledge.

Règles strictes :
- N'invente AUCUN chrono, allure, FC ou cadence absent du contexte.
- Corréle prévisions et sorties récentes.
- Signale les trous de données.
- Réponds UNIQUEMENT avec un objet JSON valide UTF-8 (aucun texte avant/après).
- Le champ "markdown" est du markdown lisible (titres ##, listes), PAS du JSON.
- Le plan calendrier est géré ailleurs : mets "plan": [] sauf si l'athlète demande explicitement des séances dans sa question.

Schéma JSON :
{
  "summary": "synthèse 2–4 phrases en français",
  "plan": [],
  "markdown": "## Corrélations\\n- ...\\n## Points d'attention\\n- ...\\n## Nuances\\n- ..."
}
"""


def _strip_fences(text: str) -> str:
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    return text.strip()


def _balanced_json_slice(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    chunk = text[start:]
    if chunk.count("{") > chunk.count("}"):
        chunk = chunk + ("}" * (chunk.count("{") - chunk.count("}")))
    return chunk if chunk.startswith("{") else None


def _repair_json_text(chunk: str) -> str:
    repaired = chunk.strip()
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
    repaired = (
        repaired.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )
    return repaired


def _try_load_json(chunk: str) -> dict[str, Any] | None:
    for candidate in (chunk, _repair_json_text(chunk)):
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    return None


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = _strip_fences((raw or "").strip())
    if not text:
        return None

    direct = _try_load_json(text)
    if direct:
        return direct

    sliced = _balanced_json_slice(text)
    if sliced:
        loaded = _try_load_json(sliced)
        if loaded:
            return loaded

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return _try_load_json(text[start : end + 1])
    return None


def _normalize_plan_item(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    session_type = item.get("session_type")
    st = str(session_type).strip() if session_type is not None else ""
    if st and st not in SESSION_TYPE_IDS:
        st = "autre"
    date = item.get("date")
    title = item.get("title") or item.get("name") or "Séance"
    details = item.get("details") or item.get("description") or ""
    return {
        "date": str(date).strip() if date else None,
        "session_type": st or None,
        "title": str(title).strip()[:120],
        "details": str(details).strip()[:800],
        "target_pace": (
            str(item["target_pace"]).strip() if item.get("target_pace") not in (None, "") else None
        ),
        "duration_or_distance": (
            str(item["duration_or_distance"]).strip()
            if item.get("duration_or_distance") not in (None, "")
            else None
        ),
    }


def _looks_like_json(text: str) -> bool:
    s = (text or "").strip()
    return s.startswith("{") and ("summary" in s or "plan" in s or "markdown" in s)


def _format_plan_markdown(plan: list[dict[str, Any]]) -> str:
    if not plan:
        return ""
    lines = ["## Plan proposé", ""]
    for item in plan:
        date = item.get("date") or "À planifier"
        title = item.get("title") or "Séance"
        st = item.get("session_type")
        label = label_for(st) if st else None
        head = f"### {date} — {title}"
        if label:
            head += f" ({label})"
        lines.append(head)
        details = item.get("details")
        if details:
            lines.append(str(details))
        meta: list[str] = []
        if item.get("duration_or_distance"):
            meta.append(f"**Volume** : {item['duration_or_distance']}")
        if item.get("target_pace"):
            meta.append(f"**Allure** : {item['target_pace']}")
        if meta:
            lines.append("")
            lines.extend(f"- {m}" for m in meta)
        lines.append("")
    return "\n".join(lines).strip()


def _ensure_readable_markdown(
    summary: str,
    plan: list[dict[str, Any]],
    markdown: str,
) -> str:
    md = (markdown or "").strip()
    if md and not _looks_like_json(md):
        return md
    parts: list[str] = []
    if summary and not _looks_like_json(summary):
        parts.append(summary)
    plan_md = _format_plan_markdown(plan)
    if plan_md:
        parts.append(plan_md)
    if not parts:
        return "Analyse indisponible sous forme lisible. Relancez l’analyse."
    return "\n\n".join(parts)


def parse_coach_answer(raw: str) -> dict[str, Any]:
    """Parse la réponse modèle en summary / plan / markdown (+ answer legacy)."""
    data = _extract_json_object(raw)
    if data:
        summary = str(data.get("summary") or "").strip()
        markdown = str(data.get("markdown") or "").strip()
        plan_raw = data.get("plan")
        plan: list[dict[str, Any]] = []
        if isinstance(plan_raw, list):
            for item in plan_raw[:10]:
                normalized = _normalize_plan_item(item)
                if normalized:
                    plan.append(normalized)
        if not summary and markdown and not _looks_like_json(markdown):
            summary = markdown.split("\n", 1)[0].lstrip("# ").strip()[:400]
        if not summary:
            summary = "Conseil généré — voir le plan et l’analyse ci-dessous."
        if _looks_like_json(summary):
            m = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', raw or "", re.DOTALL)
            if m:
                try:
                    summary = json.loads(f'"{m.group(1)}"')
                except json.JSONDecodeError:
                    summary = m.group(1)
            else:
                summary = "Conseil généré — voir le plan et l’analyse ci-dessous."
        markdown = _ensure_readable_markdown(summary, plan, markdown)
        return {
            "summary": summary,
            "plan": plan,
            "markdown": markdown,
            "answer": markdown,
            "structured": True,
        }

    text = (raw or "").strip()
    if _looks_like_json(text):
        summary_match = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
        summary = "Réponse partiellement lisible."
        if summary_match:
            try:
                summary = json.loads(f'"{summary_match.group(1)}"')
            except json.JSONDecodeError:
                summary = summary_match.group(1)[:400]
        return {
            "summary": summary,
            "plan": [],
            "markdown": (
                f"{summary}\n\n"
                "_Le modèle a renvoyé un JSON incomplet. "
                "Relancez l’analyse pour obtenir le plan détaillé._"
            ),
            "answer": summary,
            "structured": False,
        }

    summary = text[:400] if text else "Réponse non structurée."
    return {
        "summary": summary,
        "plan": [],
        "markdown": text if text else summary,
        "answer": text,
        "structured": False,
    }


def coach_status(db: Session, env: Settings) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    reachable = client.is_reachable()
    installed = False
    installed_models: list[str] = []
    error = None
    if reachable:
        try:
            installed_models = client.list_models()
            installed = client.model_installed(model)
        except OllamaError as exc:
            error = str(exc)
            reachable = False
    return {
        "reachable": reachable,
        "ollama_base_url": env.ollama_base_url,
        "model": model,
        "model_installed": installed,
        "installed_models": installed_models,
        "allowed_models": list(settings_service.ALLOWED_OLLAMA_MODELS),
        "chat_timeout_s": env.ollama_chat_timeout_s,
        "error": error,
        "ready": reachable and installed,
    }


def pull_configured_model(db: Session, env: Settings) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable():
        raise OllamaError("Ollama injoignable | action=vérifier_service_docker_ollama")
    client.pull_model(model)
    return {
        "model": model,
        "model_installed": client.model_installed(model),
        "message": f"Modèle {model} téléchargé (ou déjà présent).",
    }


def advise(db: Session, env: Settings, *, question: str | None = None) -> dict[str, Any]:
    model = settings_service.get_ollama_model(db, env)
    client = OllamaClient(env.ollama_base_url)
    if not client.is_reachable():
        raise OllamaError("Ollama injoignable | action=démarrer_service_ollama")
    if not client.model_installed(model):
        raise OllamaError(
            f"Modèle {model} non installé | action=Admin_télécharger_le_modèle_ou_pull_cli"
        )

    context = build_coach_context(db, recent_limit=8)
    pack = knowledge.load_pack(max_chars=6000)
    question_text = (question or "").strip() or (
        "Analyse ma forme et mes prévisions d'allure. "
        "Corréle HR, types de séance et min/km avec les estimations. "
        "Ne génère pas de plan calendrier (plan déjà géré séparément)."
    )
    user_message = (
        f"Pack knowledge :\n{pack}\n\n"
        "Question athlète :\n"
        f"{question_text}\n\n"
        "Contexte JSON (source de vérité) :\n"
        f"{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}\n\n"
        "Rappel : réponds UNIQUEMENT avec le JSON {summary, plan, markdown}."
    )

    num_predict = max(env.ollama_num_predict, 1200)
    raw = client.chat(
        model=model,
        system=SYSTEM_PROMPT,
        user=user_message,
        timeout_s=env.ollama_chat_timeout_s,
        num_predict=num_predict,
        keep_alive=env.ollama_keep_alive,
    )
    parsed = parse_coach_answer(raw)
    logger.info(
        "Conseil coach généré | model=%s | activities=%s | structured=%s | plan=%s | chars=%s",
        model,
        len(context.get("recent_activities") or []),
        parsed["structured"],
        len(parsed["plan"]),
        len(raw),
    )
    return {
        "model": model,
        "answer": parsed["answer"],
        "summary": parsed["summary"],
        "plan": parsed["plan"],
        "markdown": parsed["markdown"],
        "structured": parsed["structured"],
        "context_summary": {
            "predictions_available": bool((context.get("predictions") or {}).get("available")),
            "confidence": (context.get("predictions") or {}).get("confidence"),
            "analytics_category": (context.get("analytics") or {}).get("category"),
            "recent_activities": len(context.get("recent_activities") or []),
        },
    }

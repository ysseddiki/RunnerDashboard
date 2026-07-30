"""Jobs coach async (single-flight) : plan + analyses activités."""

from __future__ import annotations

import logging
import threading
from typing import Any

from app.config import get_settings
from app.db import SessionLocal

logger = logging.getLogger("coach.jobs")

_plan_lock = threading.Lock()
_analysis_lock = threading.Lock()
_plan_running: set[int] = set()
_analysis_running: set[int] = set()


def schedule_plan_refresh(*, user_id: int, reason: str = "manual") -> bool:
    """Démarre un refresh plan en thread si aucun n’est déjà en cours pour ce user."""
    with _plan_lock:
        if user_id in _plan_running:
            logger.info(
                "Refresh plan ignoré (déjà en cours) | user_id=%s | reason=%s",
                user_id,
                reason,
            )
            return False
        _plan_running.add(user_id)

    def _run() -> None:
        try:
            from app.services import coach_plan as coach_plan_service

            db = SessionLocal()
            try:
                env = get_settings()
                coach_plan_service.refresh_plan(db, env, user_id, reason=reason)
            finally:
                db.close()
        except Exception:
            logger.exception(
                "Échec job refresh plan | user_id=%s | reason=%s", user_id, reason
            )
        finally:
            with _plan_lock:
                _plan_running.discard(user_id)

    threading.Thread(
        target=_run, name=f"coach-plan-refresh-{user_id}", daemon=True
    ).start()
    logger.info("Job refresh plan démarré | user_id=%s | reason=%s", user_id, reason)
    return True


def schedule_missing_analyses(
    *, user_id: int, limit: int = 3, reason: str = "manual"
) -> bool:
    with _analysis_lock:
        if user_id in _analysis_running:
            logger.info(
                "Analyses activités ignorées (déjà en cours) | user_id=%s | reason=%s",
                user_id,
                reason,
            )
            return False
        _analysis_running.add(user_id)

    def _run() -> None:
        try:
            from app.services import activity_coach as activity_coach_service

            db = SessionLocal()
            try:
                env = get_settings()
                activity_coach_service.analyze_missing(
                    db, env, user_id, limit=limit
                )
            finally:
                db.close()
        except Exception:
            logger.exception(
                "Échec job analyses activités | user_id=%s | reason=%s",
                user_id,
                reason,
            )
        finally:
            with _analysis_lock:
                _analysis_running.discard(user_id)

    threading.Thread(
        target=_run, name=f"coach-activity-analysis-{user_id}", daemon=True
    ).start()
    logger.info(
        "Job analyses activités démarré | user_id=%s | reason=%s | limit=%s",
        user_id,
        reason,
        limit,
    )
    return True


def after_sync_hooks(*, user_id: int, created: int) -> dict[str, Any]:
    scheduled: dict[str, Any] = {"plan": False, "analyses": False}
    if created > 0:
        scheduled["plan"] = schedule_plan_refresh(user_id=user_id, reason="post-sync")
        scheduled["analyses"] = schedule_missing_analyses(
            user_id=user_id, limit=3, reason="post-sync"
        )
    return scheduled

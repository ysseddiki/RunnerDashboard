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
_plan_running = False
_analysis_running = False


def schedule_plan_refresh(*, reason: str = "manual") -> bool:
    """Démarre un refresh plan en thread si aucun n’est déjà en cours."""
    global _plan_running
    with _plan_lock:
        if _plan_running:
            logger.info("Refresh plan ignoré (déjà en cours) | reason=%s", reason)
            return False
        _plan_running = True

    def _run() -> None:
        global _plan_running
        try:
            from app.services import coach_plan as coach_plan_service

            db = SessionLocal()
            try:
                env = get_settings()
                coach_plan_service.refresh_plan(db, env, reason=reason)
            finally:
                db.close()
        except Exception:
            logger.exception("Échec job refresh plan | reason=%s", reason)
        finally:
            with _plan_lock:
                _plan_running = False

    threading.Thread(target=_run, name="coach-plan-refresh", daemon=True).start()
    logger.info("Job refresh plan démarré | reason=%s", reason)
    return True


def schedule_missing_analyses(*, limit: int = 3, reason: str = "manual") -> bool:
    global _analysis_running
    with _analysis_lock:
        if _analysis_running:
            logger.info("Analyses activités ignorées (déjà en cours) | reason=%s", reason)
            return False
        _analysis_running = True

    def _run() -> None:
        global _analysis_running
        try:
            from app.services import activity_coach as activity_coach_service

            db = SessionLocal()
            try:
                env = get_settings()
                activity_coach_service.analyze_missing(db, env, limit=limit)
            finally:
                db.close()
        except Exception:
            logger.exception("Échec job analyses activités | reason=%s", reason)
        finally:
            with _analysis_lock:
                _analysis_running = False

    threading.Thread(target=_run, name="coach-activity-analysis", daemon=True).start()
    logger.info("Job analyses activités démarré | reason=%s | limit=%s", reason, limit)
    return True


def after_sync_hooks(*, created: int) -> dict[str, Any]:
    scheduled: dict[str, Any] = {"plan": False, "analyses": False}
    if created > 0:
        scheduled["plan"] = schedule_plan_refresh(reason="post-sync")
        scheduled["analyses"] = schedule_missing_analyses(limit=3, reason="post-sync")
    return scheduled

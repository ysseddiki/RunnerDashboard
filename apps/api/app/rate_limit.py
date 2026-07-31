"""Rate limiting en mémoire, par utilisateur.

Fenêtre glissante simple. Suffisant pour un déploiement mono-processus
(uvicorn sans workers multiples) ; pour du multi-instances, remplacer
par un backend partagé (Redis).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from app import auth as auth_service
from app.models import User


class SlidingWindowLimiter:
    def __init__(self, max_calls: int, window_s: float):
        self.max_calls = max_calls
        self.window_s = window_s
        self._hits: dict[int, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def retry_after(self, user_id: int) -> float | None:
        """None si l'appel est autorisé (et compté), sinon délai d'attente en secondes."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[user_id]
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.max_calls:
                return self.window_s - (now - hits[0])
            hits.append(now)
            return None


def rate_limited(max_calls: int, window_s: float):
    """Dépendance FastAPI : authentifie puis limite par utilisateur (429 sinon)."""
    limiter = SlidingWindowLimiter(max_calls, window_s)

    def dependency(user: User = Depends(auth_service.require_user)) -> User:
        wait = limiter.retry_after(user.id)
        if wait is not None:
            raise HTTPException(
                status_code=429,
                detail="Trop de requêtes — réessayez dans quelques instants",
                headers={"Retry-After": str(max(1, int(wait) + 1))},
            )
        return user

    return dependency

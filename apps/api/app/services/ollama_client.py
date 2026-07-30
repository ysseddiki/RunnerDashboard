"""Client HTTP Ollama (local uniquement)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger("coach.ollama")


class OllamaError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class OllamaClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def is_reachable(self) -> bool:
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
            return res.status_code < 500
        except httpx.HTTPError:
            return False

    def list_models(self) -> list[str]:
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
            if res.status_code >= 400:
                raise OllamaError(
                    f"Ollama tags HTTP {res.status_code}",
                    status_code=res.status_code,
                )
            payload = res.json()
            models = payload.get("models") or []
            names: list[str] = []
            for item in models:
                if isinstance(item, dict) and item.get("name"):
                    names.append(str(item["name"]))
            return names
        except httpx.HTTPError as exc:
            raise OllamaError(f"Ollama injoignable | detail={exc}") from exc

    def model_installed(self, model: str) -> bool:
        target = model.strip()
        for name in self.list_models():
            if name == target or name.startswith(target):
                return True
        return False

    def list_loaded_models(self) -> list[str]:
        """Modèles actuellement en mémoire (Ollama /api/ps)."""
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(f"{self.base_url}/api/ps")
            if res.status_code >= 400:
                return []
            payload = res.json()
            models = payload.get("models") or []
            names: list[str] = []
            for item in models:
                if isinstance(item, dict) and item.get("name"):
                    names.append(str(item["name"]))
            return names
        except httpx.HTTPError:
            return []

    def is_model_loaded(self, model: str) -> bool:
        target = model.strip()
        for name in self.list_loaded_models():
            if name == target or name.startswith(target):
                return True
        return False

    def warmup_model(
        self,
        model: str,
        *,
        keep_alive: str | int = -1,
        timeout_s: float = 600.0,
    ) -> dict[str, Any]:
        """Charge le modèle en RAM via un chat minimal (num_predict=1)."""
        logger.info("Warmup Ollama | model=%s | keep_alive=%s", model, keep_alive)
        keep_alive_value: str | int
        if isinstance(keep_alive, int):
            keep_alive_value = keep_alive
        else:
            raw = str(keep_alive).strip()
            keep_alive_value = int(raw) if raw.lstrip("-").isdigit() else raw
        timeout = httpx.Timeout(connect=30.0, read=timeout_s, write=60.0, pool=30.0)
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model,
                        "stream": False,
                        "keep_alive": keep_alive_value,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Tu es un assistant. Réponds uniquement OK.",
                            },
                            {"role": "user", "content": "ping"},
                        ],
                        "options": {"temperature": 0, "num_predict": 4},
                    },
                )
            if res.status_code >= 400:
                raise OllamaError(
                    f"Échec chargement modèle (HTTP {res.status_code})",
                    status_code=res.status_code,
                )
            loaded = self.is_model_loaded(model)
            logger.info("Warmup Ollama OK | model=%s | loaded=%s", model, loaded)
            return {
                "model": model,
                "loaded": loaded or True,
                "message": f"Modèle {model} chargé en mémoire.",
            }
        except httpx.TimeoutException as exc:
            raise OllamaError(
                f"Timeout chargement modèle après {int(timeout_s)}s "
                f"(modèle={model}). Réessayez — le 1er load CPU est long."
            ) from exc
        except httpx.HTTPError as exc:
            raise OllamaError(f"Ollama warmup injoignable | detail={exc}") from exc

    def pull_model(self, model: str) -> dict[str, Any]:
        logger.info("Pull modèle Ollama | model=%s", model)
        try:
            with httpx.Client(timeout=900.0) as client:
                res = client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": model, "stream": False},
                )
            if res.status_code >= 400:
                logger.error(
                    "Échec pull Ollama | model=%s | status=%s | detail=%s",
                    model,
                    res.status_code,
                    res.text[:300],
                )
                raise OllamaError(
                    f"Échec pull modèle {model} (HTTP {res.status_code})",
                    status_code=res.status_code,
                )
            logger.info("Pull modèle OK | model=%s", model)
            return res.json() if res.content else {"status": "success"}
        except httpx.HTTPError as exc:
            raise OllamaError(f"Échec pull Ollama | detail={exc}") from exc

    def chat(
        self,
        *,
        model: str,
        system: str,
        user: str,
        timeout_s: float = 600.0,
        num_predict: int = 650,
        keep_alive: str | int = -1,
    ) -> str:
        logger.info(
            "Chat Ollama | model=%s | user_chars=%s | timeout_s=%s | num_predict=%s | keep_alive=%s",
            model,
            len(user),
            timeout_s,
            num_predict,
            keep_alive,
        )
        timeout = httpx.Timeout(
            connect=30.0,
            read=timeout_s,
            write=60.0,
            pool=30.0,
        )
        # Ollama accepte int (-1) ou durée string ("10m", "24h")
        keep_alive_value: str | int
        if isinstance(keep_alive, int):
            keep_alive_value = keep_alive
        else:
            raw = str(keep_alive).strip()
            keep_alive_value = int(raw) if raw.lstrip("-").isdigit() else raw
        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model,
                        "stream": False,
                        "keep_alive": keep_alive_value,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "options": {
                            "temperature": 0.3,
                            "num_predict": num_predict,
                        },
                    },
                )
            if res.status_code >= 400:
                logger.error(
                    "Échec chat Ollama | model=%s | status=%s | detail=%s",
                    model,
                    res.status_code,
                    res.text[:400],
                )
                raise OllamaError(
                    f"Échec chat Ollama (HTTP {res.status_code}) — "
                    "modèle installé ? action=pull_model_admin",
                    status_code=res.status_code,
                )
            data = res.json()
            message = data.get("message") or {}
            content = message.get("content")
            if not isinstance(content, str) or not content.strip():
                raise OllamaError("Réponse Ollama vide")
            return content.strip()
        except httpx.TimeoutException as exc:
            logger.error(
                "Timeout chat Ollama | model=%s | timeout_s=%s | detail=%s",
                model,
                timeout_s,
                str(exc),
            )
            raise OllamaError(
                f"Ollama chat timeout après {int(timeout_s)}s "
                f"(modèle={model}). Sur CPU le 1er appel charge le modèle en RAM — "
                "réessayez, ou passez à qwen2.5:7b dans Admin si la VM a ~16 Go."
            ) from exc
        except httpx.HTTPError as exc:
            raise OllamaError(f"Ollama chat injoignable | detail={exc}") from exc

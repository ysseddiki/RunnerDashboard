"""Configuration de l'API RunningDashboard."""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


DEV_SESSION_SECRET = "dev-change-me-runningdashboard-session"


def parse_ollama_num_thread(raw: str, *, cpu_count: int | None = None) -> int | None:
    """Interprète auto / 0 / N → threads Ollama (None = défaut Ollama)."""
    value = (raw or "").strip().lower()
    if value in {"", "0", "default", "all"}:
        return None
    if value in {"auto", "-1", "max-1", "n-1"}:
        n = cpu_count if cpu_count is not None else (os.cpu_count() or 2)
        return max(1, n - 1)
    try:
        parsed = int(value)
    except ValueError:
        n = cpu_count if cpu_count is not None else (os.cpu_count() or 2)
        return max(1, n - 1)
    if parsed <= 0:
        return None
    return parsed


def normalize_ollama_num_thread_raw(raw: str) -> str:
    """Normalise une saisie Admin/env vers auto | 0 | N."""
    value = (raw or "").strip().lower()
    if value in {"auto", "-1", "max-1", "n-1"}:
        return "auto"
    if value in {"", "0", "default", "all"}:
        return "0"
    try:
        n = int(value)
    except ValueError as exc:
        raise ValueError(
            "Threads CPU invalides. Utilisez auto, 0 (tous), ou un entier ≥ 1."
        ) from exc
    if n < 0:
        raise ValueError("Le nombre de threads ne peut pas être négatif.")
    if n == 0:
        return "0"
    cpus = os.cpu_count() or 64
    if n > max(cpus, 128):
        raise ValueError(f"Trop de threads (max conseillé {max(cpus, 128)}).")
    return str(n)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "RunningDashboard API"
    environment: str = "development"
    log_dir: str = "/var/log/running-dashboards/host-logs"
    log_level: str = "INFO"
    log_file_name: str = "api.log"
    database_url: str = "postgresql+psycopg://running:running@postgres:5432/runningdashboard"
    cors_origins: str = (
        "https://localhost,https://localhost:443,http://localhost,"
        "http://localhost:80,http://localhost:5173"
    )
    public_app_url: str = "http://localhost"
    strava_client_id: str = ""
    strava_client_secret: str = ""
    strava_redirect_uri: str = "http://localhost/api/auth/strava/callback"
    strava_scopes: str = "read,activity:read_all,profile:read_all"
    ollama_model: str = "qwen2.5:14b"
    ollama_base_url: str = "http://ollama:11434"
    # CPU 14B : 1er appel (chargement modèle) peut dépasser 3–5 min
    ollama_chat_timeout_s: float = 600.0
    ollama_num_predict: int = 650
    # -1 = ne jamais décharger le modèle (reste en RAM tant qu’Ollama tourne)
    ollama_keep_alive: str = "-1"
    # Threads CPU Ollama : "auto" = (nproc − 1), "0" = défaut Ollama (tous), ou entier
    ollama_num_thread: str = "auto"
    # Cookie session signé (obligatoire en prod)
    session_secret: str = DEV_SESSION_SECRET
    # Clé de chiffrement au repos des tokens Strava (défaut : dérivée de session_secret)
    token_encryption_key: str = ""
    session_cookie_name: str = "rd_session"
    session_max_age_s: int = 60 * 60 * 24 * 30  # 30 jours
    # Cookie Secure si l’app est servie en HTTPS
    session_cookie_secure: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    def resolved_ollama_num_thread(self) -> int | None:
        """Fallback env seul (préférer settings.get_resolved_ollama_num_thread avec DB)."""
        return parse_ollama_num_thread(self.ollama_num_thread)


@lru_cache
def get_settings() -> Settings:
    return Settings()

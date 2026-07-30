"""Configuration de l'API RunningDashboard."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # Cookie session signé (obligatoire en prod)
    session_secret: str = "dev-change-me-runningdashboard-session"
    session_cookie_name: str = "rd_session"
    session_max_age_s: int = 60 * 60 * 24 * 30  # 30 jours
    # Cookie Secure si l’app est servie en HTTPS
    session_cookie_secure: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

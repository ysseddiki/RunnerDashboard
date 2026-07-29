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
    strava_redirect_uri: str = "http://localhost/api/strava/callback"
    strava_scopes: str = "read,activity:read_all,profile:read_all"
    ollama_model: str = "qwen2.5:14b"


@lru_cache
def get_settings() -> Settings:
    return Settings()

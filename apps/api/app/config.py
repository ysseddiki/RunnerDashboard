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
    cors_origins: str = "https://localhost,https://localhost:443,http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()

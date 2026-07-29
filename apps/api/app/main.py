"""Point d'entrée FastAPI — socle P0."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.logging_config import setup_logging

logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    log_path = setup_logging(settings.log_dir, settings.log_level, settings.log_file_name)
    logger.info(
        "Démarrage API | app=%s | env=%s | log_path=%s",
        settings.app_name,
        settings.environment,
        log_path,
    )
    yield
    logger.info("Arrêt API | raison=shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "api",
            "version": "0.1.0",
            "palier": "P0",
        }

    @application.get("/api/health")
    def health_prefixed():
        """Alias derrière le reverse proxy (/api → api)."""
        return health()

    return application


app = create_app()

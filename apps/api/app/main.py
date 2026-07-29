"""Point d'entrée FastAPI — palier P2."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.logging_config import setup_logging
from app.routers import activities, strava

logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    log_path = setup_logging(settings.log_dir, settings.log_level, settings.log_file_name)
    logger.info(
        "Démarrage API | app=%s | env=%s | log_path=%s | palier=P2",
        settings.app_name,
        settings.environment,
        log_path,
    )
    init_db()
    logger.info("Schéma base initialisé | action=create_all")
    yield
    logger.info("Arrêt API | raison=shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.3.0",
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
    @application.get("/api/health")
    def health():
        return {
            "status": "ok",
            "service": "api",
            "version": "0.3.0",
            "palier": "P2",
        }

    application.include_router(strava.router)
    application.include_router(activities.router)
    return application


app = create_app()

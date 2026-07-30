"""Point d'entrée FastAPI — palier P4."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.logging_config import setup_logging
from app.routers import activities, analytics, apple_health, strava
from app.routers import coach as coach_router
from app.routers import predictions as predictions_router
from app.routers import profile as profile_router
from app.routers import projections as projections_router
from app.routers import settings as settings_router

logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    log_path = setup_logging(settings.log_dir, settings.log_level, settings.log_file_name)
    logger.info(
        "Démarrage API | app=%s | env=%s | log_path=%s | palier=P4",
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
        version="0.5.0",
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
            "version": "0.5.0",
            "palier": "P4",
        }

    application.include_router(strava.router)
    application.include_router(activities.router)
    application.include_router(apple_health.router)
    application.include_router(analytics.router)
    application.include_router(predictions_router.router)
    application.include_router(coach_router.router)
    application.include_router(settings_router.router)
    application.include_router(profile_router.router)
    application.include_router(projections_router.router)
    return application


app = create_app()

"""Session SQLAlchemy."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # Migrations légères sans Alembic
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS weather_json JSONB")
        )
        conn.execute(
            text(
                "ALTER TABLE activities ADD COLUMN IF NOT EXISTS session_type VARCHAR(32)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_activities_session_type "
                "ON activities (session_type)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE activities ADD COLUMN IF NOT EXISTS source VARCHAR(16) "
                "DEFAULT 'strava'"
            )
        )
        conn.execute(
            text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS apple_uuid VARCHAR(64)")
        )
        conn.execute(
            text(
                "UPDATE activities SET source = 'strava' "
                "WHERE source IS NULL OR source = ''"
            )
        )
        # strava_id nullable for Apple-only activities
        conn.execute(text("ALTER TABLE activities ALTER COLUMN strava_id DROP NOT NULL"))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_activities_apple_uuid "
                "ON activities (apple_uuid) WHERE apple_uuid IS NOT NULL"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_activities_source ON activities (source)"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE activities ADD COLUMN IF NOT EXISTS coach_analysis_json JSONB"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE activities ADD COLUMN IF NOT EXISTS coach_analyzed_at "
                "TIMESTAMPTZ"
            )
        )

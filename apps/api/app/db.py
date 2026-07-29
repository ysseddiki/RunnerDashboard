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
    # Migrations légères sans Alembic (P2)
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

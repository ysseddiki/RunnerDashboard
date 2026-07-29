"""Logging applicatif : fichiers + stdout, messages FR explicites."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


class FrenchFormatter(logging.Formatter):
    """Format lisible : timestamp | LEVEL | module | message."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )


def setup_logging(log_dir: str, log_level: str, log_file_name: str) -> Path:
    """Configure le logging. Retourne le chemin du fichier de log principal."""
    directory = Path(log_dir)
    directory.mkdir(parents=True, exist_ok=True)
    log_path = directory / log_file_name

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    formatter = FrenchFormatter()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    root.addHandler(stream_handler)

    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    # Réduire le bruit des libs tierces
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logging.getLogger("observability").info(
        "Logging initialisé | log_dir=%s | log_file=%s | level=%s",
        directory,
        log_path.name,
        log_level.upper(),
    )
    return log_path

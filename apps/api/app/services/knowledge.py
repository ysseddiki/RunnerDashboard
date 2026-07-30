"""Charge le pack de connaissance coach (fichiers locaux)."""

from __future__ import annotations

from pathlib import Path

_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
_MAX_CHARS = 12000


def load_pack(*, max_chars: int = _MAX_CHARS) -> str:
    if not _KNOWLEDGE_DIR.is_dir():
        return ""
    parts: list[str] = []
    for path in sorted(_KNOWLEDGE_DIR.glob("*.md")):
        try:
            text = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if text:
            parts.append(f"### Fichier {path.name}\n{text}")
    blob = "\n\n".join(parts).strip()
    if len(blob) > max_chars:
        return blob[: max_chars - 20] + "\n\n[…tronqué…]"
    return blob

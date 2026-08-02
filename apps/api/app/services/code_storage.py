"""Inventaire de stockage « code » pour l’admin."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        ".venv",
        "venv",
        "node_modules",
        "dist",
        "build",
        ".next",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".turbo",
        "coverage",
        ".idea",
        ".vscode",
        ".cursor",
    }
)

# Dépendances / artefacts : comptés à part
DEP_DIR_NAMES = frozenset({".venv", "venv", "node_modules", "dist", "build", ".next"})

SOURCE_EXTENSIONS: dict[str, str] = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".css": "CSS",
    ".scss": "CSS",
    ".html": "HTML",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".toml": "Config",
    ".sql": "SQL",
    ".sh": "Shell",
    ".Dockerfile": "Docker",
}

TOP_BUCKETS = (
    "apps/api",
    "apps/web",
    "openspec",
    "infra",
    "knowledge",
    "scripts",
)


def _human_bytes(n: int) -> str:
    units = ("o", "Ko", "Mo", "Go", "To")
    size = float(n)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "o":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{n} o"


def detect_code_root(explicit: str | None = None) -> Path | None:
    """Résout la racine du code (monorepo ou package API seul)."""
    candidates: list[Path] = []
    if explicit and explicit.strip():
        candidates.append(Path(explicit.strip()))
    env_root = os.environ.get("CODE_ROOT", "").strip()
    if env_root:
        candidates.append(Path(env_root))
    # Conteneur : monorepo monté en lecture seule
    candidates.append(Path("/code"))
    candidates.append(Path("/workspace"))
    # Chemin local depuis ce fichier → …/apps/api/app/services → repo
    here = Path(__file__).resolve()
    candidates.append(here.parents[4] if len(here.parents) >= 5 else here.parents[-1])
    candidates.append(Path("/app"))

    seen: set[Path] = set()
    for cand in candidates:
        try:
            root = cand.resolve()
        except OSError:
            continue
        if root in seen or not root.is_dir():
            continue
        seen.add(root)
        # Monorepo RunningDashboard
        if (root / "apps" / "api").is_dir() and (root / "openspec").is_dir():
            return root
        # Package API seul (image Docker)
        if (root / "app").is_dir() and (
            (root / "app" / "main.py").is_file() or (root / "app" / "services").is_dir()
        ):
            return root
    return None


def _count_loc(path: Path) -> int:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return 0
    return sum(1 for line in text.splitlines() if line.strip())


def _bucket_for(rel: str) -> str:
    for prefix in TOP_BUCKETS:
        if rel == prefix or rel.startswith(prefix + "/"):
            return prefix
    if rel.startswith("apps/"):
        parts = rel.split("/")
        if len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"
    top = rel.split("/", 1)[0] if rel else "."
    return top or "."


def _dir_size(path: Path) -> tuple[int, int]:
    """Taille totale + nombre de fichiers (récursif, ignore erreurs)."""
    total = 0
    files = 0
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [d for d in dirnames if d not in {".git"}]
        for name in filenames:
            try:
                total += (Path(dirpath) / name).stat().st_size
                files += 1
            except OSError:
                continue
    return total, files


def scan_code_storage(root: Path) -> dict[str, Any]:
    """Parcourt root : sources (hors deps) + deps séparées + LOC."""
    root = root.resolve()
    source_bytes = 0
    source_files = 0
    dep_bytes = 0
    dep_files = 0
    loc_by_lang: dict[str, int] = defaultdict(int)
    files_by_lang: dict[str, int] = defaultdict(int)
    bytes_by_bucket: dict[str, int] = defaultdict(int)
    files_by_bucket: dict[str, int] = defaultdict(int)
    loc_by_bucket: dict[str, int] = defaultdict(int)
    largest: list[tuple[int, str]] = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Dépendances : taille agrégée, ne pas descendre
        for d in list(dirnames):
            if d in DEP_DIR_NAMES:
                size, nfiles = _dir_size(Path(dirpath) / d)
                dep_bytes += size
                dep_files += nfiles
                dirnames.remove(d)
            elif d in SKIP_DIR_NAMES:
                dirnames.remove(d)

        for name in filenames:
            path = Path(dirpath) / name
            try:
                size = path.stat().st_size
            except OSError:
                continue
            rel = str(path.relative_to(root)).replace("\\", "/")
            source_bytes += size
            source_files += 1
            bucket = _bucket_for(rel)
            bytes_by_bucket[bucket] += size
            files_by_bucket[bucket] += 1
            largest.append((size, rel))

            ext = path.suffix.lower()
            if path.name == "Dockerfile" or path.name.startswith("Dockerfile."):
                lang = "Docker"
            else:
                lang = SOURCE_EXTENSIONS.get(ext)
            if lang:
                files_by_lang[lang] += 1
                loc = _count_loc(path)
                loc_by_lang[lang] += loc
                loc_by_bucket[bucket] += loc

    largest.sort(key=lambda x: x[0], reverse=True)
    top_files = [
        {"path": p, "bytes": b, "bytes_label": _human_bytes(b)} for b, p in largest[:15]
    ]

    buckets = [
        {
            "id": bid,
            "bytes": bytes_by_bucket[bid],
            "bytes_label": _human_bytes(bytes_by_bucket[bid]),
            "files": files_by_bucket[bid],
            "loc": loc_by_bucket.get(bid, 0),
        }
        for bid in sorted(bytes_by_bucket.keys(), key=lambda k: -bytes_by_bucket[k])
    ]

    languages = [
        {
            "id": lang,
            "files": files_by_lang[lang],
            "loc": loc_by_lang[lang],
        }
        for lang in sorted(files_by_lang.keys(), key=lambda k: -loc_by_lang[k])
    ]

    mode = "monorepo" if (root / "apps" / "api").is_dir() else "api_package"

    return {
        "available": True,
        "root": str(root),
        "mode": mode,
        "mode_label_fr": (
            "Dépôt complet (monorepo)"
            if mode == "monorepo"
            else "Package API seul (image Docker)"
        ),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "bytes": source_bytes,
            "bytes_label": _human_bytes(source_bytes),
            "files": source_files,
            "loc_total": sum(loc_by_lang.values()),
        },
        "dependencies": {
            "bytes": dep_bytes,
            "bytes_label": _human_bytes(dep_bytes),
            "files": dep_files,
            "note_fr": "node_modules, .venv, dist… exclus du total « sources ».",
        },
        "buckets": buckets,
        "languages": languages,
        "largest_files": top_files,
        "notes_fr": [
            "Les dossiers node_modules / .venv / dist / .git sont exclus des sources.",
            "En conteneur API sans montage du dépôt, seul le code Python embarqué est visible.",
        ],
    }

def build_storage_report(*, code_root: str | None = None) -> dict[str, Any]:
    root = detect_code_root(code_root)
    if root is None:
        return {
            "available": False,
            "reason_fr": (
                "Impossible de localiser le code. "
                "Définissez CODE_ROOT ou montez le dépôt en /code."
            ),
            "source": None,
            "dependencies": None,
            "buckets": [],
            "languages": [],
            "largest_files": [],
        }
    return scan_code_storage(root)

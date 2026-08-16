from __future__ import annotations

import re
from pathlib import Path

from download_engine.config import MAX_FILENAME_LENGTH

INVALID_FILENAME_CHARS = r'[\\/:*?"<>|]'


def ensure_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def sanitize_name(name: str, max_length: int = MAX_FILENAME_LENGTH) -> str:
    cleaned = re.sub(INVALID_FILENAME_CHARS, "", name)
    cleaned = cleaned.strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        cleaned = "download"
    return cleaned[:max_length].rstrip("._") or "download"


def ensure_unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    counter = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def temporary_prefix(directory: Path, base_name: str) -> Path:
    return directory / sanitize_name(base_name, max_length=80)

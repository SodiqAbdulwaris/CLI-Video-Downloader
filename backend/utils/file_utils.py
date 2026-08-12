from __future__ import annotations

import re
from pathlib import Path

from config.settings import MAX_FILENAME_LENGTH
from services.settings_service import settings_service

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


def resolve_output_path(media_type: str = "video", playlist_title: str | None = None) -> Path:
    """Return the configured download directory.

    All media (single videos, Shorts, playlists) is saved directly into this
    directory — no per-type or per-playlist subfolders are created.
    """
    return ensure_directory(settings_service.require_target_download_dir())


def temporary_prefix(directory: Path, base_name: str) -> Path:
    return directory / sanitize_name(base_name, max_length=80)

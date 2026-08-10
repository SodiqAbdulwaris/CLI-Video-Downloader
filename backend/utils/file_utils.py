from __future__ import annotations

import re
from pathlib import Path

from config.settings import MAX_FILENAME_LENGTH, PLAYLISTS_DIR, SHORTS_DIR, SINGLE_VIDEOS_DIR

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


def resolve_output_path(media_type: str, playlist_title: str | None = None) -> Path:
    if media_type == "short":
        return ensure_directory(SHORTS_DIR)
    if media_type == "playlist":
        return ensure_directory(PLAYLISTS_DIR / sanitize_name(playlist_title or "Playlist"))
    return ensure_directory(SINGLE_VIDEOS_DIR)


def temporary_prefix(directory: Path, base_name: str) -> Path:
    return directory / sanitize_name(base_name, max_length=80)

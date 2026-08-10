from __future__ import annotations

from datetime import datetime
from pathlib import Path

from config.settings import DOWNLOAD_LOG_FILE, ERROR_LOG_FILE


def _write_entry(path: Path, entry: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(entry)


def log_error(
    *,
    url: str,
    media_type: str,
    resolution: str,
    format_type: str,
    codec: str,
    download_path: str,
    filename: str,
    error_message: str,
) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = (
        f"[{timestamp}] ERROR\n"
        f"URL: {url}\n"
        f"Type: {media_type}\n"
        f"Resolution: {resolution}\n"
        f"Format: {format_type}\n"
        f"Codec: {codec}\n"
        f"Download Path: {download_path}\n"
        f"Filename: {filename}\n"
        f"Error Message: {error_message}\n"
        "---\n"
    )
    _write_entry(ERROR_LOG_FILE, entry)


def log_download(
    *,
    url: str,
    media_type: str,
    resolution: str,
    format_type: str,
    codec: str,
    download_path: str,
    filename: str,
) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = (
        f"[{timestamp}] SUCCESS\n"
        f"URL: {url}\n"
        f"Type: {media_type}\n"
        f"Resolution: {resolution}\n"
        f"Format: {format_type}\n"
        f"Codec: {codec}\n"
        f"Download Path: {download_path}\n"
        f"Filename: {filename}\n"
        "---\n"
    )
    _write_entry(DOWNLOAD_LOG_FILE, entry)

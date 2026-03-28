from __future__ import annotations

from datetime import datetime

from config.settings import LOG_FILE


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
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(entry)

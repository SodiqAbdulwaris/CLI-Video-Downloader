from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Allows overriding the downloads root via environment variable so Docker
# containers can bind-mount the host Downloads folder without touching code.
# Falls back to the OS default location when the variable is not set.
_DOWNLOADS_ROOT_ENV = os.environ.get("DOWNLOADS_ROOT")
DOWNLOADS_ROOT = Path(_DOWNLOADS_ROOT_ENV) if _DOWNLOADS_ROOT_ENV else Path.home() / "Downloads" / "YT-Video Downloader"
COOKIES_FILE_PATH = PROJECT_ROOT / "config" / "cookies.txt"
ERROR_LOG_FILE = PROJECT_ROOT / "errors.log"
DOWNLOAD_LOG_FILE = DOWNLOADS_ROOT / "download_history.log"

# Docker bind-mount strategy. When running inside Docker, Compose mounts the
# host download folder at /downloads and sets DOWNLOADS_ROOT=/downloads. The
# backend only ever writes through the container-side path; the host path is
# kept purely for display/validation and never hard-coded in download logic.
RUNNING_IN_DOCKER = _DOWNLOADS_ROOT_ENV is not None
CONTAINER_DOWNLOADS_ROOT = _DOWNLOADS_ROOT_ENV if _DOWNLOADS_ROOT_ENV else "/downloads"
_DOWNLOADS_ROOT_HOST_ENV = os.environ.get("DOWNLOADS_ROOT_HOST")
HOST_DOWNLOADS_ROOT = Path(_DOWNLOADS_ROOT_HOST_ENV) if _DOWNLOADS_ROOT_HOST_ENV else None

DEFAULT_RESOLUTION_PRIORITY = ["720p", "480p"]
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_RETRY_ATTEMPTS = 3
MAX_FILENAME_LENGTH = 200

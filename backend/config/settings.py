from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Assumes the OS Downloads folder has not been relocated from its default location.
DOWNLOADS_ROOT = Path.home() / "Downloads" / "YT-Video Downloader"
COOKIES_FILE_PATH = PROJECT_ROOT / "config" / "cookies.txt"
SINGLE_VIDEOS_DIR = DOWNLOADS_ROOT / "Single Videos"
SHORTS_DIR = DOWNLOADS_ROOT / "Shorts"
PLAYLISTS_DIR = DOWNLOADS_ROOT / "Playlists"
ERROR_LOG_FILE = PROJECT_ROOT / "errors.log"
DOWNLOAD_LOG_FILE = DOWNLOADS_ROOT / "download_history.log"

DEFAULT_RESOLUTION_PRIORITY = ["720p", "480p"]
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_RETRY_ATTEMPTS = 3
MAX_FILENAME_LENGTH = 200

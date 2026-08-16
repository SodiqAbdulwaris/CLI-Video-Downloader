from __future__ import annotations

from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = ENGINE_ROOT.parent

COOKIES_FILE_PATH = REPO_ROOT / "cookies" / "cookies.txt"
ERROR_LOG_FILE = REPO_ROOT / "errors.log"
DOWNLOAD_LOG_FILE = Path.home() / "Downloads" / "YT-Video Downloader" / "download_history.log"

DEFAULT_RESOLUTION_PRIORITY = ["720p", "480p"]
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_RETRY_ATTEMPTS = 3
MAX_FILENAME_LENGTH = 200

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from threading import Lock
from typing import Any

from config.settings import (
    CONTAINER_DOWNLOADS_ROOT,
    HOST_DOWNLOADS_ROOT,
    RUNNING_IN_DOCKER,
)

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
SETTINGS_FILE_PATH = DATA_DIR / "settings.json"

_file_lock = Lock()

_WINDOWS_DRIVE = re.compile(r"^[A-Za-z]:/")
_WINDOWS_UNC = re.compile(r"^//[^/]+/")


class SettingsError(RuntimeError):
    """Base error raised for invalid or unusable download location values."""


class DownloadLocationRequiredError(SettingsError):
    """Raised when a download is attempted before a location has been configured."""


def _normalize_host_reference(raw_value: str) -> str:
    """Return a normalized, absolute host directory reference.

    Accepted shapes are Windows drive paths (``C:\\Users\\...``), Windows UNC
    paths, and POSIX absolute paths. On Windows the value is resolved against
    the real filesystem; on POSIX (the Docker container) a Windows-style host
    reference cannot be stat'ed, so it is only normalized for storage/display.
    """
    candidate = str(raw_value).strip().strip("\"'")
    if not candidate:
        raise SettingsError("Download location cannot be empty.")

    if os.name == "nt":
        path = Path(os.path.expandvars(os.path.expanduser(candidate)))
        if not path.is_absolute():
            raise SettingsError(
                "Provide an absolute directory path, e.g. C:\\Users\\YourName\\Downloads"
            )
        return str(path)

    forward = candidate.replace("\\", "/")
    if _WINDOWS_DRIVE.match(forward) or _WINDOWS_UNC.match(forward) or forward.startswith("/"):
        return forward
    raise SettingsError(
        "Provide an absolute directory path, e.g. C:\\Users\\YourName\\Downloads"
    )


def _same_host_path(left: str, right: str) -> bool:
    return left.replace("\\", "/").casefold() == right.replace("\\", "/").casefold()


class SettingsService:
    """Persists application settings (download location) in backend/data/settings.json."""

    def __init__(self, file_path: Path = SETTINGS_FILE_PATH) -> None:
        self.file_path = file_path

    def _ensure_data_dir(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _read_raw_settings(self) -> dict[str, Any]:
        self._ensure_data_dir()
        if not self.file_path.exists():
            return {"download_directory": None}

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                logger.warning("Settings file structure invalid; treating as unconfigured.")
                return {"download_directory": None}
            value = data.get("download_directory")
            return {"download_directory": value if isinstance(value, str) else None}
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse settings.json: %s", exc)
            return {"download_directory": None}
        except Exception as exc:
            logger.error("Failed to read settings.json: %s", exc)
            return {"download_directory": None}

    def _write_raw_settings(self, data: dict[str, Any]) -> None:
        self._ensure_data_dir()
        tmp_file = self.file_path.with_suffix(".json.tmp")
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            tmp_file.replace(self.file_path)
        except Exception as exc:
            logger.error("Failed to write settings file safely: %s", exc)
            if tmp_file.exists():
                try:
                    tmp_file.unlink()
                except OSError:
                    pass
            raise SettingsError(f"Could not save the download location: {exc}") from exc

    def get_download_directory(self) -> str | None:
        with _file_lock:
            return self._read_raw_settings()["download_directory"]

    def get_settings(self) -> dict[str, str | None]:
        with _file_lock:
            return self._read_raw_settings()

    def update_download_directory(self, raw_value: str) -> dict[str, str]:
        value = _normalize_host_reference(raw_value)
        if RUNNING_IN_DOCKER:
            if HOST_DOWNLOADS_ROOT is not None and not _same_host_path(
                value, str(HOST_DOWNLOADS_ROOT)
            ):
                raise SettingsError(
                    "This app runs in Docker and downloads through a host folder that is "
                    "bind-mounted at container start. Files land in the mounted folder "
                    f"('{HOST_DOWNLOADS_ROOT}'). To use a different folder, update "
                    "DOWNLOADS_ROOT_HOST in the .env file and re-run 'docker compose up -d'."
                )
            self._require_writable_directory(Path(CONTAINER_DOWNLOADS_ROOT))
        else:
            host_path = Path(os.path.expandvars(os.path.expanduser(value)))
            self._require_writable_directory(host_path)

        with _file_lock:
            self._write_raw_settings({"download_directory": value})
        return {"download_directory": value}

    def _require_writable_directory(self, directory: Path) -> None:
        try:
            directory.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise SettingsError(f"Could not create the download directory: {exc}") from exc
        if not directory.is_dir():
            raise SettingsError(f"Not a directory: {directory}")
        if not os.access(directory, os.W_OK):
            raise SettingsError(f"The download directory is not writable: {directory}")

    def get_target_download_dir(self) -> Path | None:
        """Effective filesystem directory used for actual downloads.

        In Docker this returns the container-side mount target (/downloads);
        otherwise it returns the stored host path directly.
        """
        if RUNNING_IN_DOCKER:
            return Path(CONTAINER_DOWNLOADS_ROOT)
        host = self.get_download_directory()
        if host is None:
            return None
        return Path(host)

    def require_target_download_dir(self) -> Path:
        target = self.get_target_download_dir()
        if target is None:
            raise DownloadLocationRequiredError(
                "A download location has not been configured. Choose where downloads "
                "should be saved (Settings → Download Location) before starting downloads."
            )
        return target


settings_service = SettingsService()

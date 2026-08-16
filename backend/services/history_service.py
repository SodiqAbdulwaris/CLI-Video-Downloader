from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from threading import Lock
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
HISTORY_FILE_PATH = DATA_DIR / "download_history.json"
CURRENT_VERSION = 1

_file_lock = Lock()


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    gitkeep_path = DATA_DIR / ".gitkeep"
    if not gitkeep_path.exists():
        gitkeep_path.touch()


class HistoryService:
    """Manages local download history stored in a JSON file."""

    def __init__(self, file_path: Path = HISTORY_FILE_PATH) -> None:
        self.file_path = file_path

    def _read_raw_history(self) -> dict[str, Any]:
        _ensure_data_dir()
        if not self.file_path.exists():
            return {"version": CURRENT_VERSION, "sessions": []}

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "sessions" in data and isinstance(data["sessions"], list):
                    return data
                logger.warning("History file structure invalid, returning empty history structure.")
                self._backup_corrupt_file()
                return {"version": CURRENT_VERSION, "sessions": []}
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse download_history.json: %s", exc)
            self._backup_corrupt_file()
            return {"version": CURRENT_VERSION, "sessions": []}
        except Exception as exc:
            logger.error("Failed to read history file: %s", exc)
            return {"version": CURRENT_VERSION, "sessions": []}

    def _backup_corrupt_file(self) -> None:
        """Preserve an unreadable history file instead of letting the next write erase it."""
        backup_path = self.file_path.with_suffix(".json.corrupt")
        try:
            self.file_path.replace(backup_path)
            logger.warning("Backed up unreadable history file to %s", backup_path)
        except OSError as exc:
            logger.error("Could not back up corrupt history file: %s", exc)

    def _write_raw_history(self, data: dict[str, Any]) -> None:
        _ensure_data_dir()
        tmp_file = self.file_path.with_suffix(".json.tmp")
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            tmp_file.replace(self.file_path)
        except Exception as exc:
            logger.error("Failed to write history file safely: %s", exc)
            if tmp_file.exists():
                try:
                    tmp_file.unlink()
                except OSError:
                    pass
            raise

    def get_history(self) -> list[dict[str, Any]]:
        with _file_lock:
            data = self._read_raw_history()
            sessions = data.get("sessions", [])
            # Sort newest first based on createdAt / completedAt
            sorted_sessions = sorted(
                sessions,
                key=lambda s: str(s.get("completedAt") or s.get("createdAt") or ""),
                reverse=True
            )
            return sorted_sessions

    def get_recent_history(self, limit: int = 5) -> list[dict[str, Any]]:
        history = self.get_history()
        return history[:limit]

    def get_history_session(self, session_id: str) -> dict[str, Any] | None:
        history = self.get_history()
        for session in history:
            if session.get("id") == session_id:
                return session
        return None

    def add_history_session(self, session: dict[str, Any]) -> None:
        with _file_lock:
            data = self._read_raw_history()
            sessions = data.get("sessions", [])
            # Remove duplicate if session with same ID already exists
            session_id = session.get("id")
            sessions = [s for s in sessions if s.get("id") != session_id]
            sessions.insert(0, session)
            data["sessions"] = sessions
            data["version"] = CURRENT_VERSION
            self._write_raw_history(data)

    def delete_history_session(self, session_id: str) -> bool:
        with _file_lock:
            data = self._read_raw_history()
            sessions = data.get("sessions", [])
            initial_count = len(sessions)
            filtered_sessions = [s for s in sessions if s.get("id") != session_id]
            if len(filtered_sessions) == initial_count:
                return False
            data["sessions"] = filtered_sessions
            self._write_raw_history(data)
            return True

    def clear_history(self) -> bool:
        with _file_lock:
            data = {"version": CURRENT_VERSION, "sessions": []}
            self._write_raw_history(data)
            return True


history_service = HistoryService()

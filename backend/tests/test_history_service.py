import json

import pytest

from services.history_service import HistoryService


@pytest.fixture
def svc(tmp_path):
    return HistoryService(file_path=tmp_path / "download_history.json")


def test_empty_history_when_file_missing(svc):
    assert svc.get_history() == []


def test_add_and_get_history_session(svc):
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z"})
    svc.add_history_session({"id": "b", "createdAt": "2026-01-02T00:00:00Z"})
    history = svc.get_history()
    assert [s["id"] for s in history] == ["b", "a"]  # newest first


def test_add_history_session_replaces_same_id(svc):
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z", "status": "failed"})
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z", "status": "completed"})
    history = svc.get_history()
    assert len(history) == 1
    assert history[0]["status"] == "completed"


def test_delete_history_session(svc):
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z"})
    assert svc.delete_history_session("a") is True
    assert svc.delete_history_session("a") is False
    assert svc.get_history() == []


def test_clear_history(svc):
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z"})
    svc.add_history_session({"id": "b", "createdAt": "2026-01-02T00:00:00Z"})
    assert svc.clear_history() is True
    assert svc.get_history() == []


def test_corrupt_json_is_backed_up_not_lost(svc):
    svc.file_path.write_text("{not valid json", encoding="utf-8")

    result = svc.get_history()

    assert result == []
    assert not svc.file_path.exists()
    backup = svc.file_path.with_suffix(".json.corrupt")
    assert backup.exists()
    assert backup.read_text(encoding="utf-8") == "{not valid json"

    # A write after the corruption should not silently destroy the backup,
    # and should produce a fresh, valid history file.
    svc.add_history_session({"id": "a", "createdAt": "2026-01-01T00:00:00Z"})
    assert json.loads(svc.file_path.read_text())["sessions"][0]["id"] == "a"
    assert backup.exists()

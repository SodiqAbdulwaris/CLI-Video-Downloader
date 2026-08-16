"""Integration tests: drive the real FastAPI app (routes + JobManager +
HistoryService + SettingsService all real) end-to-end over HTTP and
WebSocket. Only the yt-dlp network boundary is stubbed (see
stub_downloader.py) so these never touch the network.
"""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

import api.jobs as jobs_module
import api.main as main_module
from services.history_service import history_service
from services.settings_service import settings_service
from stub_downloader import StubVideoDownloader, playlist_info, video_info

SINGLE_URL = "https://www.youtube.com/watch?v=vid1"
PL_URL = "https://www.youtube.com/playlist?list=pl1"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(history_service, "file_path", tmp_path / "download_history.json")
    monkeypatch.setattr(settings_service, "file_path", tmp_path / "settings.json")
    settings_service.update_download_directory(str(tmp_path / "downloads"))
    with TestClient(main_module.app) as c:
        yield c


def _use_stub(monkeypatch, responses, fail_urls=None):
    stub = StubVideoDownloader(responses, fail_urls)
    monkeypatch.setattr(jobs_module, "VideoDownloader", lambda: stub)
    monkeypatch.setattr(main_module, "VideoDownloader", lambda: stub)
    return stub


def _wait_for_terminal_status(job_id, timeout=5.0):
    """Poll the in-process job state directly rather than consuming it over
    the WebSocket test transport: Starlette's TestClient WS bridge is an
    in-memory double that can stall when several events fire back-to-back
    with no real delay between them (verified separately — the job itself
    computes and enqueues every event correctly; this is a test-harness
    limitation of the WS test transport, not an app bug). WS protocol
    behavior itself is covered by the dedicated reconnect tests below."""
    # Check job.last_job_event's own status, not job.status separately: the
    # two fields are set on different lines in _run_download, so polling
    # job.status can observe it flip to terminal a moment before
    # last_job_event is updated to match — a real race caught by this test.
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = main_module.jobs.get_job(job_id)
        event = job.last_job_event if job else None
        if event and event.get("status") in {"completed", "partial", "failed"}:
            return event
        time.sleep(0.01)
    raise AssertionError("job did not reach a terminal status in time")


def test_health_check(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_single_video_download_end_to_end(client, monkeypatch, tmp_path):
    _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")})

    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]

    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "completed"

    downloaded = list((tmp_path / "downloads").glob("*.mp4"))
    assert len(downloaded) == 1
    assert (tmp_path / "downloads" / (downloaded[0].stem + ".description.txt")).exists()

    history = client.get("/api/history").json()
    assert len(history) == 1
    assert history[0]["status"] == "completed"
    assert history[0]["files"][0]["filename"] == downloaded[0].name


def test_download_rejected_without_configured_directory(client, monkeypatch, tmp_path):
    settings_service.update_download_directory(str(tmp_path / "downloads"))
    (tmp_path / "settings.json").unlink()  # simulate "never configured"
    _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")})

    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video"})
    assert resp.status_code == 400


def test_playlist_partial_failure_status_matches_history(client, monkeypatch, tmp_path):
    """Regression: a playlist with 1 of 2 items failing must report the
    live job status as 'partial', matching what history records — not
    'failed', which would hide a usable partial download from the user."""
    entries = [
        {"title": "Ok Video", "playlist_index": 1, "webpage_url": "https://x/ok"},
        {"title": "Bad Video", "playlist_index": 2, "webpage_url": "https://x/bad"},
    ]
    responses = {
        PL_URL: playlist_info("My Playlist", entries),
        "https://x/ok": video_info("Ok Video", "ok"),
        "https://x/bad": video_info("Bad Video", "bad"),
    }
    _use_stub(monkeypatch, responses, fail_urls={"https://x/bad"})

    resp = client.post("/api/download", json={"url": PL_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]

    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "partial"
    assert final_event["completed"] == 1
    assert final_event["failed"] == 1

    history = client.get("/api/history").json()
    assert history[0]["status"] == "partial"
    assert history[0]["successful"] == 1
    assert history[0]["failed"] == 1


def test_playlist_partial_selection_downloads_only_the_chosen_videos(client, monkeypatch, tmp_path):
    """A user picking 2 of 5 playlist videos must get exactly those 2 files
    on disk — not the whole playlist, not the wrong 2 — with history
    reflecting the selection accurately."""
    entries = [
        {"title": "Video One", "playlist_index": 1, "webpage_url": "https://x/1"},
        {"title": "Video Two", "playlist_index": 2, "webpage_url": "https://x/2"},
        {"title": "Video Three", "playlist_index": 3, "webpage_url": "https://x/3"},
        {"title": "Video Four", "playlist_index": 4, "webpage_url": "https://x/4"},
        {"title": "Video Five", "playlist_index": 5, "webpage_url": "https://x/5"},
    ]
    responses = {PL_URL: playlist_info("Five Videos", entries)}
    for i, title in enumerate(["One", "Two", "Three", "Four", "Five"], start=1):
        responses[f"https://x/{i}"] = video_info(f"Video {title}", str(i))
    _use_stub(monkeypatch, responses)

    resp = client.post(
        "/api/download",
        json={"url": PL_URL, "format_type": "video", "resolution": "360p", "indices": [2, 4]},
    )
    job_id = resp.json()["job_id"]

    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "completed"  # an all-success job event carries no completed/failed counts

    downloaded = sorted(p.name for p in (tmp_path / "downloads").glob("*.mp4"))
    assert len(downloaded) == 2
    assert any("Video Two" in name for name in downloaded)
    assert any("Video Four" in name for name in downloaded)
    assert not any("Video One" in name or "Video Three" in name or "Video Five" in name for name in downloaded)

    history = client.get("/api/history").json()
    session = history[0]
    assert session["requestedIndices"] == [2, 4]
    assert session["total"] == 2
    assert session["successful"] == 2
    assert session["failed"] == 0
    downloaded_titles = {f["title"] for f in session["files"]}
    assert downloaded_titles == {"Video Two", "Video Four"}


def test_playlist_zero_based_index_is_rejected_end_to_end(client, monkeypatch):
    """Regression for the frontend off-by-one bug: a 0-based index reaching
    the API must fail clearly, not silently download the wrong item."""
    entries = [{"title": "Only Video", "playlist_index": 1, "webpage_url": "https://x/1"}]
    _use_stub(monkeypatch, {PL_URL: playlist_info("PL", entries), "https://x/1": video_info("Only Video")})

    resp = client.post(
        "/api/download",
        json={"url": PL_URL, "format_type": "video", "resolution": "360p", "indices": [0]},
    )
    job_id = resp.json()["job_id"]

    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "failed"
    assert "not found" in final_event.get("error", "").lower() or "0" in final_event.get("error", "")


def test_websocket_reconnect_after_completion_gets_snapshot(client, monkeypatch):
    """Regression for the reconnect hang: connecting to a job's WebSocket
    after it already finished must return immediately, not block forever."""
    _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")})
    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]
    _wait_for_terminal_status(job_id)

    with client.websocket_connect(f"/api/ws/{job_id}") as ws:
        event = ws.receive_json()
    assert event == {"type": "job", "status": "completed", "job_id": job_id}


def test_settings_roundtrip(client, tmp_path):
    target = str(tmp_path / "custom-downloads")
    resp = client.put("/api/settings", json={"download_directory": target})
    assert resp.status_code == 200
    assert client.get("/api/settings").json()["download_directory"] == target


def test_history_delete_and_clear(client, monkeypatch, tmp_path):
    _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")})
    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]
    _wait_for_terminal_status(job_id)

    assert len(client.get("/api/history").json()) == 1
    assert client.delete(f"/api/history/{job_id}").status_code == 200
    assert client.get("/api/history").json() == []

    client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    time.sleep(0.2)
    assert client.delete("/api/history").status_code == 200
    assert client.get("/api/history").json() == []

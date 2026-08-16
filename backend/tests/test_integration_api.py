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


def _use_stub(monkeypatch, responses, fail_urls=None, hold=False):
    stub = StubVideoDownloader(responses, fail_urls, hold=hold)
    monkeypatch.setattr(jobs_module, "VideoDownloader", lambda: stub)
    monkeypatch.setattr(main_module, "VideoDownloader", lambda: stub)
    return stub


def _wait_until(predicate, timeout=5.0, interval=0.02):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


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

    # Playlist items land in a subfolder named after the playlist.
    downloaded = sorted(p.name for p in (tmp_path / "downloads" / "Five Videos").glob("*.mp4"))
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
    assert session["downloadLocation"] == str(tmp_path / "downloads" / "Five Videos")


def test_single_video_download_has_no_subfolder(client, monkeypatch, tmp_path):
    """Only playlists get a subfolder — a single video still lands directly
    in the configured download directory."""
    _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")})
    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]
    _wait_for_terminal_status(job_id)

    assert list((tmp_path / "downloads").glob("*.mp4")) != []
    assert list((tmp_path / "downloads").iterdir()) == [
        p for p in (tmp_path / "downloads").iterdir() if p.is_file()
    ]  # no subdirectories created

    session = client.get("/api/history").json()[0]
    assert session["downloadLocation"] == str(tmp_path / "downloads")


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
    assert event == {
        "type": "job", "status": "completed", "job_id": job_id,
        "completed": 1, "failed": 0,
    }


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


def _task_ids(job_id):
    return list(main_module.jobs.get_job(job_id).task_ids)


def _task_state(task_id):
    return main_module.jobs.get_task(task_id).state


def test_settings_concurrency_roundtrip(client):
    resp = client.put("/api/settings", json={"max_concurrent_downloads": 5})
    assert resp.status_code == 200
    assert client.get("/api/settings").json()["max_concurrent_downloads"] == 5


def test_settings_concurrency_rejects_out_of_range(client):
    resp = client.put("/api/settings", json={"max_concurrent_downloads": 16})
    assert resp.status_code == 400
    resp = client.put("/api/settings", json={"max_concurrent_downloads": 0})
    assert resp.status_code == 400


def test_concurrency_limit_is_respected_across_playlist_items(client, monkeypatch):
    """4 playlist videos, limit 2: never more than 2 should be mid-download
    at once, exercising the same per-video scheduling used across jobs."""
    client.put("/api/settings", json={"max_concurrent_downloads": 2})
    entries = [
        {"title": f"Video {i}", "playlist_index": i, "webpage_url": f"https://x/{i}"}
        for i in range(1, 5)
    ]
    responses = {PL_URL: playlist_info("Four Videos", entries)}
    for i in range(1, 5):
        responses[f"https://x/{i}"] = video_info(f"Video {i}", str(i))
    stub = _use_stub(monkeypatch, responses, hold=True)

    resp = client.post("/api/download", json={"url": PL_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]

    assert _wait_until(lambda: stub.active_count >= 2), "expected 2 concurrent downloads to start"
    time.sleep(0.15)  # give a 3rd/4th a chance to slip through if the limit were broken
    assert stub.active_count <= 2
    assert stub.peak_active <= 2

    stub.release()
    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "completed"


def test_two_separate_jobs_share_the_concurrency_limit(client, monkeypatch):
    """Concurrency applies across jobs too, not just within one playlist."""
    client.put("/api/settings", json={"max_concurrent_downloads": 1})
    url_a = "https://www.youtube.com/watch?v=aaa"
    url_b = "https://www.youtube.com/watch?v=bbb"
    stub = _use_stub(monkeypatch, {url_a: video_info("A", "aaa"), url_b: video_info("B", "bbb")}, hold=True)

    resp_a = client.post("/api/download", json={"url": url_a, "format_type": "video", "resolution": "360p"})
    resp_b = client.post("/api/download", json={"url": url_b, "format_type": "video", "resolution": "360p"})

    assert _wait_until(lambda: stub.active_count >= 1)
    time.sleep(0.15)
    assert stub.active_count <= 1
    assert stub.peak_active <= 1

    stub.release()
    _wait_for_terminal_status(resp_a.json()["job_id"])
    _wait_for_terminal_status(resp_b.json()["job_id"])


def test_pause_then_resume_completes_the_job(client, monkeypatch):
    stub = _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")}, hold=True)
    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]

    assert _wait_until(lambda: stub.active_count >= 1)
    task_id = _task_ids(job_id)[0]

    pause_resp = client.post(f"/api/tasks/{task_id}/pause")
    assert pause_resp.status_code == 200
    assert _wait_until(lambda: _task_state(task_id) == "paused")
    assert _wait_until(lambda: main_module.jobs.get_job(job_id).status == "paused")

    resume_resp = client.post(f"/api/tasks/{task_id}/resume")
    assert resume_resp.status_code == 200
    assert _wait_until(lambda: stub.active_count >= 1)

    stub.release()
    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "completed"


def test_cancel_task_leaves_no_partial_file(client, monkeypatch, tmp_path):
    stub = _use_stub(monkeypatch, {SINGLE_URL: video_info("Test Video")}, hold=True)
    resp = client.post("/api/download", json={"url": SINGLE_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]

    assert _wait_until(lambda: stub.active_count >= 1)
    task_id = _task_ids(job_id)[0]

    cancel_resp = client.post(f"/api/tasks/{task_id}/cancel")
    assert cancel_resp.status_code == 200
    assert _wait_until(lambda: _task_state(task_id) == "cancelled")

    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "failed"  # the only task was cancelled, none succeeded
    assert list((tmp_path / "downloads").glob("*.mp4")) == []


def test_cancel_job_cancels_every_pending_task(client, monkeypatch):
    """Cancelling a whole job stops both the active download and any videos
    still waiting for a concurrency slot."""
    client.put("/api/settings", json={"max_concurrent_downloads": 1})
    entries = [
        {"title": "Video 1", "playlist_index": 1, "webpage_url": "https://x/1"},
        {"title": "Video 2", "playlist_index": 2, "webpage_url": "https://x/2"},
        {"title": "Video 3", "playlist_index": 3, "webpage_url": "https://x/3"},
    ]
    responses = {PL_URL: playlist_info("Three Videos", entries)}
    for i in range(1, 4):
        responses[f"https://x/{i}"] = video_info(f"Video {i}", str(i))
    _use_stub(monkeypatch, responses, hold=True)

    resp = client.post("/api/download", json={"url": PL_URL, "format_type": "video", "resolution": "360p"})
    job_id = resp.json()["job_id"]
    assert _wait_until(lambda: any(_task_state(t) == "downloading" for t in _task_ids(job_id)))

    cancel_resp = client.post(f"/api/jobs/{job_id}/cancel")
    assert cancel_resp.status_code == 200

    assert _wait_until(lambda: all(_task_state(t) == "cancelled" for t in _task_ids(job_id)))
    final_event = _wait_for_terminal_status(job_id)
    assert final_event["status"] == "failed"

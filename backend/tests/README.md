# Backend tests

Three kinds of test live here, in increasing order of what they actually exercise:

| Type | What it touches | Network? | Run with |
|---|---|---|---|
| Unit | A single function/class in isolation | No | `uv run pytest backend/tests` (default) |
| Integration | The real FastAPI app, JobManager, HistoryService, SettingsService together, driven over HTTP/WebSocket | No — the yt-dlp boundary is stubbed | `uv run pytest backend/tests` (default) |
| System | The real app end to end, including real `yt-dlp` and real YouTube | Yes | Run the `manual_*.py` script directly |

`pytest`'s default discovery (`test_*.py`) picks up everything except the `manual_` prefixed scripts, so `uv run pytest backend/tests` runs all unit + integration tests (30 as of writing) without touching the network, and stays fast and deterministic.

## Unit tests

| File | Covers |
|---|---|
| `test_history_service.py` | JSON history file: add/get/delete/clear, dedup by id, and that a corrupt file gets backed up (`.json.corrupt`) instead of silently overwritten. |
| `test_downloader_error_logging.py` | `errors.log` gets exactly one entry per real failure — not zero, not two — across the retry-exhaustion path, the playlist per-item path, and pre-download failures. |
| `test_error_explanations.py` | `_explain_download_error()` expands 403/429/bot-detection errors into a message with cause + fix + README pointer; leaves unrelated errors untouched. |
| `test_playlist_indexing.py` | Playlist entries are 1-based end to end; a 0-based index is rejected instead of silently resolving to the wrong item. |
| `test_resolve_thumbnail_matching.py` | `/api/resolve`'s O(1) thumbnail lookup still matches correctly by URL first, falling back to title only when no URL match exists. |
| `test_websocket_reconnect.py` | The `/api/ws/{job_id}` handler directly (fake in-memory WebSocket, no real transport): live jobs stream normally; a client that connects after the job is already terminal gets an immediate snapshot instead of hanging; that snapshot carries the real error, not a bare status. |

## Integration tests (`test_integration_api.py`)

Uses `fastapi.testclient.TestClient` against the real app. Only `core.downloader.VideoDownloader` is swapped for `StubVideoDownloader` (see `stub_downloader.py`) — a real `VideoDownloader` subclass with just the actual yt-dlp network calls (`fetch_info`, `_download_stream`) replaced by canned data. Everything else — retry logic, error logging, playlist iteration, partial/failed status, filename generation, history persistence, WebSocket event emission — runs for real.

`HistoryService`/`SettingsService` are pointed at a `tmp_path` per test via monkeypatch, so tests never touch `backend/data/*.json`.

Covers: health check, a full single-video download (file lands on disk, history recorded, `.description.txt` written), selecting a subset of a playlist (e.g. picking 2 of 5 videos downloads exactly those 2, not the whole playlist — also verified live against a real 25-video YouTube playlist), download rejected without a configured directory, settings roundtrip, history delete/clear — plus the regression cases below.

### A known test-infrastructure quirk

`_wait_for_terminal_status()` polls the job object in-process rather than consuming the WebSocket stream. Starlette's `TestClient` WebSocket transport is an in-memory test double that can stall when several events fire back-to-back with no real delay between them (verified directly: the job itself computes and enqueues every event correctly in that scenario — this is a limitation of the WS *test* transport, not the app). Real usage doesn't hit this because actual downloads take real wall-clock time between events. The WS protocol itself is still exercised for real by `test_websocket_reconnect_after_completion_gets_snapshot`, which connects after the job is already finished and only needs one message.

## System test (`manual_custom_dir_download.py`)

Real network, real `yt-dlp`, real `VideoDownloader`, real `SettingsService`. Sets a custom download directory, downloads a real video, verifies the file landed there, then restores whatever directory was configured before the run. Takes an optional cookies-file path argument to test with different cookies without touching `backend/config/cookies.txt`.

```bash
uv run python backend/tests/manual_custom_dir_download.py
uv run python backend/tests/manual_custom_dir_download.py path\to\other\cookies.txt
```

## Regression tests — bug → test

| Bug (found this session) | Guarded by |
|---|---|
| Corrupt `download_history.json` silently overwritten, losing all history | `test_history_service.py::test_corrupt_json_is_backed_up_not_lost` |
| Playlist item failures logged to `errors.log` twice | `test_downloader_error_logging.py::test_playlist_download_does_not_double_log_already_logged_failure` |
| Partial playlist success reported as job `"failed"` instead of `"partial"`, contradicting history | `test_integration_api.py::test_playlist_partial_failure_status_matches_history` |
| WebSocket reconnect after a finished job hangs forever (queue already drained) | `test_websocket_reconnect.py::test_reconnect_after_completed_job_gets_snapshot_not_a_hang`, `test_integration_api.py::test_websocket_reconnect_after_completion_gets_snapshot` |
| Reconnect snapshot dropped the error message, showing "failed" with no explanation | `test_websocket_reconnect.py::test_reconnect_replays_full_last_job_event_including_error` |
| Frontend showed playlist item `#N+1` instead of `#N` (off-by-one), and a 0-based index could reach the backend | `test_playlist_indexing.py::test_select_positions_rejects_zero_based_index`, `test_integration_api.py::test_playlist_zero_based_index_is_rejected_end_to_end` |
| O(n²) thumbnail matching in `/api/resolve` | `test_resolve_thumbnail_matching.py` |
| Bare "403 Forbidden" shown to the user with no explanation of cause or fix | `test_error_explanations.py` |

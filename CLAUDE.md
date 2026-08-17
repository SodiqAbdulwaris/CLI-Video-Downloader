# CLAUDE.md

Architecture reference for this repo, written for a Claude Code session with no prior context. Read this before making changes — it explains not just what the code does but why it's shaped this way, which is usually the part that's expensive to re-derive from scratch.

## What this is

A YouTube downloader with three interfaces sharing one download engine: a local web app (FastAPI + React), a CLI, and (backend only) a Docker deployment. Supports single videos, Shorts, full/partial playlists, audio-only (MP3), pause/resume/cancel per video, and configurable concurrent downloads.

## Repository layout

```
download_engine/     Shared engine — yt-dlp wrapper, format selection, FFmpeg,
                      playlist parsing, filesystem/logging/validation helpers.
                      Depends on nothing else in this repo. Both the CLI and
                      the backend depend on IT, never on each other.
cli/                  CLI entry point (main.py), prompts (interface.py),
                      progress display (progress.py). Reads the same
                      backend/data/settings.json the web app writes, so the
                      download location is shared, not duplicated.
cookies/cookies.txt   Netscape-format cookies, gitignored. Shared by engine.
backend/
  api/                FastAPI routes + the job/task scheduler (jobs.py — the
                       most important file in the backend, see below)
  config/             Backend-only settings: CORS, Docker downloads-root env
  services/           HistoryService, SettingsService (JSON file persistence)
  data/                download_history.json, settings.json — gitignored,
                       runtime state
  tests/              pytest suite — unit + integration (real FastAPI app,
                       yt-dlp network calls stubbed). See backend/tests/README.md
  run_api.py           uvicorn entry point
frontend/src/
  hooks/useDownloadJobs.ts   Per-job WebSocket lifecycle (see Frontend below)
  hooks/useDownloadHistory.ts
  components/DownloadsView.tsx   Multi-job progress UI, pause/resume/cancel
  lib/api.ts            All backend HTTP/WS calls
  types/download.ts     Wire types shared conceptually with the backend
                        (not codegen'd — kept in sync by hand)
docs/agent-log/       Historical record of past AI-agent work sessions on
                      this repo. NOT living documentation — don't treat it
                      as current; check the actual code instead.
compose.yaml, Dockerfile   Backend-only containerization. Frontend always
                           runs natively (npm run dev), never in Docker.
```

This structure is the result of a restructure (commit `99842c4`, "Restructure: extract download engine and CLI out of backend/") that pulled the download engine and CLI out of `backend/` into top-level packages, specifically so neither depends on FastAPI or anything backend-specific.

## Backend architecture: the job/task model

This is the part worth understanding deeply before touching `backend/api/jobs.py`.

**Two levels, not one.** A `DownloadJob` is what the user requested (one URL — a single video, or a playlist selection). A `DownloadTask` is one video's actual download. A single-video job has exactly one task; a playlist job has one task per selected video. **Every task — whether standalone or from a playlist — is scheduled independently through the same `ConcurrencyGate`.** This is the key architectural decision: it's what makes "download 2 videos from this playlist at once" and "run 2 separate jobs at once" the same mechanism, sharing one global concurrency limit (default 2, user-configurable 1–15 via Settings → `max_concurrent_downloads`).

**Flow**, `backend/api/jobs.py`:
1. `POST /api/download` → `JobManager.create_job()` — creates a `DownloadJob`, fires off `_resolve_and_schedule` in a worker thread, returns `job_id` immediately.
2. `_resolve_and_schedule` — resolves the URL (single video or playlist listing), builds one `DownloadTask` per video, then hands each task to `_run_task` as an asyncio task.
3. `_run_task` — awaits a slot from `ConcurrencyGate`, marks the task `downloading`, runs the actual download in a worker thread (`_run_task_blocking`), releases the slot, updates job status.
4. `_run_task_blocking` — calls into `download_engine.downloader.VideoDownloader.download()`. This is the only place that touches yt-dlp for an actual download.
5. Job status is *derived* from task states (`_derive_job_status`), not tracked independently — `running` while any task is queued/downloading, `paused` if any task is paused and none are active, else `completed`/`partial`/`failed` based on the done/failed split once every task is terminal.

**`ConcurrencyGate`** (top of jobs.py) is a hand-rolled semaphore, not `asyncio.Semaphore`, specifically because the limit needs to change at runtime when the user edits the Settings value — a real semaphore's capacity is fixed at construction. It also rebinds its `asyncio.Condition` to whichever event loop is currently running (`_condition_for_current_loop`), because `JobManager` is a module-level singleton — fine in the real server (one loop for the process lifetime) but not across the fresh event loop each pytest `TestClient` spins up.

**Pause/resume/cancel** work by *interrupting yt-dlp mid-transfer*, not by suspending a thread. Each `DownloadTask` carries `pause_event`/`cancel_event` (`threading.Event`). The progress hook passed into yt-dlp checks both on every callback and raises `yt_dlp.utils.DownloadCancelled` if either is set — yt-dlp catches this internally and aborts cleanly. `_run_task_blocking` distinguishes pause from cancel by checking which event was set. **Resume restarts that video's download from 0%, it does not resume from a byte offset** — this was a deliberate simplification (merged video+audio downloads make true byte-resume messy mid-merge) confirmed with the project owner, not an oversight. Cancelling deletes the partial file (also a confirmed decision, not a default).

**Progress bar smoothing.** A "merged" download (separate video + audio streams, muxed together — most non-progressive-mp4 formats) downloads two full 0–100% streams back to back through the *same* progress hook. Without correction the reported percent visibly resets from ~100% to ~0% when the audio stream starts. `_weighted_percent()` fixes this with a fixed 0–85% (video) / 85–100% (audio) split — video is almost always the larger stream, so this is a good approximation without tracking byte totals across both streams. `_stage_from_filename()` figures out which stream a given hook callback belongs to by checking whether the temp filename contains `video_stream` or `audio_stream` (see `download_engine/downloader.py`'s `_download_once`, which names temp files that way specifically so this works).

**Backend-down detection** lives on the frontend (`useDownloadJobs.ts`), not the backend — a job's `DownloadJob` and its state only exist in-process, so if the backend actually dies there's nothing server-side to detect. The frontend's WebSocket reconnect logic distinguishes "still retrying" from "gave up after `MAX_RECONNECT_ATTEMPTS` (5)" — the latter sets `socketStatus: 'failed'`, which `DownloadsView.tsx` renders as a persistent amber "lost connection" banner with a manual retry button, instead of just going quiet.

**No persistence across a backend restart.** Everything above is in-memory (`JobManager._jobs`/`_tasks` are plain dicts). If the backend process restarts, in-progress/paused jobs are gone; any partial file on disk is orphaned. This is a confirmed, deliberate scope decision — not a bug, don't build job persistence unless explicitly asked to change this.

## Playlist downloads get their own subfolder

`download_engine/downloader.py`'s `download()`: when a `playlist_title` is passed, the target directory becomes `download_path/sanitize_name(playlist_title)/` instead of `download_path/` directly. This is a single change point that both the API (`jobs.py`, which always passes `playlist_title` for playlist jobs) and the CLI (`cli/main.py`'s `download_playlist()` call) pick up automatically. Single videos/Shorts/audio are unaffected. `HistoryService`'s `downloadLocation` field is computed to match (see `_save_history` in `jobs.py`) so history points at where the files actually are, not just the configured root.

## Error handling: `_explain_download_error`

Raw yt-dlp errors (`HTTP Error 403: Forbidden`, etc.) are expanded into a message with likely cause + what to do + a pointer to the README's Troubleshooting section, via `_explain_download_error()` in `download_engine/downloader.py`. This only fires for bot-detection-shaped errors (403/429/"sign in to confirm"/etc.) — everything else passes through unchanged. `errors.log` always gets the *raw* error; only the user-facing exception message is expanded. Playlist item failures are logged to `errors.log` exactly once — a `.logged` marker on the exception prevents the double-logging that happens if you naively log both where the error originates and where it's caught.

## The real root cause of most "downloads fail" reports

Investigated deeply earlier in this project's history: YouTube 403s are overwhelmingly caused by a **stale `cookies.txt`**, not yt-dlp configuration. `__Secure-*SIDTS` cookies carry far-future expiry timestamps but are rotated server-side independent of that expiry — a browser that's still logged in gets reissued a new value periodically, invalidating the exported copy, even though the file still *looks* valid. Confirmed by swapping in a freshly-exported cookies.txt against unmodified code and watching a previously-403ing download succeed. Don't assume a 403 report means a code bug — check cookie freshness first. Full explanation in the README's Troubleshooting section.

A related past mistake worth knowing about: an earlier session added `extractor_args`/`player_client` overrides and a `js_runtimes` config to `VideoDownloader.__init__` trying to fix 403s, which didn't actually help (proven via live A/B testing) and was broken outside Docker anyway (it assumed a `bgutil` PO-token sidecar that only exists in the Compose stack). That was reverted. If you're tempted to add extractor-args tinkering to fix a bot-detection issue, check cookie freshness first — it's very likely the actual cause.

## Frontend architecture

**Multi-job, not single-job.** `useDownloadJobs()` (`frontend/src/hooks/useDownloadJobs.ts`) manages a *dictionary* of jobs keyed by `jobId`, each with its own WebSocket connection, reconnect/backoff state, and item list — this is what lets several downloads run and display concurrently. `App.tsx` holds essentially no job state itself; it just calls `startJob(job_id)` after `POST /api/download` succeeds and renders `jobList` via `DownloadsView`.

**Status set synchronously outside the state updater.** In `handleSocketEvent`, `statusRef.current[jobId]` is set directly, *before* calling `updateJob(...)`, specifically because a WebSocket's `onclose` can fire immediately after a terminal message (the server closes the connection right after sending one) and needs to read the *current* status to decide whether to reconnect — React doesn't guarantee the state updater has run by the time `onclose` fires. This was a confirmed live bug (a just-completed job got needlessly reconnected), not speculative hardening — don't "simplify" this back to reading from React state.

**Completion dialog keyed on a status signature string, not the jobList array.** `App.tsx` builds `jobList.map(j => \`${j.jobId}:${j.status}\`).join(',')` and uses that as the effect dependency instead of `jobList` itself, because `jobList` is a fresh array every render (including from unrelated progress-percent or log updates) — using it directly caused the completion-dialog timer to get cancelled and rescheduled on every progress tick, so it never fired. Also a confirmed live bug fix, not preference.

**Task-level controls, not job-level only.** Each item row in `DownloadsView.tsx` gets its own pause/resume/cancel buttons (calling `POST /api/tasks/{task_id}/{action}`), consistent with tasks being independently scheduled server-side. There's also a job-level "Cancel all" that cancels every task in the job.

## Testing

`uv run pytest backend/tests` — unit tests (no network) + integration tests (real FastAPI app via `TestClient`, only the yt-dlp network boundary stubbed via `backend/tests/stub_downloader.py`). Read `backend/tests/README.md` for the full breakdown and a bug → regression-test map. A few `manual_*.py` scripts are excluded from pytest's default discovery on purpose (the `manual_` prefix) because they hit real YouTube — run them directly when you need to verify actual download behavior, not as part of the normal test run.

**If you add a websocket-driven test:** `starlette.testclient`'s `WebSocketTestSession.receive_json()` has no timeout parameter and can hang forever if the expected event never arrives — wrap waits in your own deadline loop, and if you ever see a test hang, suspect this before suspecting the feature code. Also: a job's background task runs via `asyncio.to_thread`, scheduled via `call_soon_threadsafe` — calling `JobManager._resolve_and_schedule` or similar directly from the *same* thread as the event loop (rather than through the real `asyncio.to_thread` path) won't deliver queued events until the loop gets control back; don't be surprised if a "direct call" reproduction shows an empty event queue immediately after returning.

## Commands

```bash
uv sync                                   # backend deps
cd frontend && npm install                # frontend deps

uv run python backend/run_api.py          # backend dev server (localhost:8000)
cd frontend && npm run dev                # frontend dev server (localhost:5173)

uv run python cli/main.py "<url>"         # CLI (shares backend/data/settings.json)

uv run pytest backend/tests               # backend test suite
cd frontend && npm run build && npm run lint

docker compose up -d --build              # backend + bgutil PO-token sidecar, Docker only
```

## Things NOT to do without asking

- Don't add job persistence across backend restarts — confirmed out of scope.
- Don't implement true byte-offset resume — confirmed out of scope (restart-from-0 was the explicit choice).
- Don't touch `extractor_args`/`player_client`/`js_runtimes` in `VideoDownloader.__init__` to "fix" a 403 — check cookies first, see above.
- Don't move existing files in a user's Downloads folder when changing download-path logic — only new downloads should follow new path rules, per an explicit prior decision.

## Assumptions

Things taken as given while writing this doc and doing the work it describes — worth re-verifying if they turn out to matter for what you're about to do:

- The `download_engine`/`cli` extraction (commit `99842c4`) is complete and intentional, not a half-finished migration — inferred from the consistency of imports across `backend/`, `cli/`, `Dockerfile`, and `compose.yaml`, not from any migration doc.
- `cookies/cookies.txt` is the single source of truth for auth cookies — no other cookie-loading path (browser-cookie extraction, per-request cookies, etc.) exists anywhere in the codebase.
- `uv sync` correctly resolves `download_engine`, `cli`, and `backend` as importable top-level packages with no explicit `[tool.uv]`/`packages` declaration needed in `pyproject.toml` — it's worked in every test/run so far, but wasn't independently verified against a clean environment from scratch.
- The frontend's `JobStatus`/`TaskState`/`SocketEvent` types (`frontend/src/types/download.ts`) are assumed to still match the backend's `JobStatus`/`TaskState` (`backend/api/jobs.py`) — there's no shared schema or codegen enforcing this, so they're kept in sync by hand and can silently drift.
- "No persistence across a backend restart" (documented above as a decision) is assumed to still be the desired behavior going forward, not just for the one feature it was decided for — a future request to add persistence would be a real scope change, not just "finishing" what's there.

## Concerns

Things that work today but are worth being cautious around:

- `ConcurrencyGate` rebinds its `asyncio.Condition` to whichever event loop is currently running, specifically to survive pytest's fresh-loop-per-`TestClient` pattern. That's fine for this app's single-process design, but it's a workaround, not a general-purpose pattern — don't copy it into code that might run across multiple worker processes.
- In-memory-only job state means a backend crash mid-download orphans the partial file silently. A user could accumulate stray partial `.mp4`/`.part` files in their Downloads folder over time with no in-app indication of why.
- `_weighted_percent()`'s 0–85/85–100 split for merged downloads is a fixed heuristic, not derived from actual byte totals — it's cosmetically close for typical video/audio bitrate ratios but not exact. Low-stakes (progress display only), but not "correct" in a strict sense.
- The `.logged` marker is a dynamically-set attribute on an exception instance (`already_logged.logged = True`), not a typed field — easy for a future refactor of the exception hierarchy to silently break without any type checker catching it.
- No automated test exercises real yt-dlp/YouTube — every integration test stubs the network boundary (`stub_downloader.py`). This is deliberate (fast, deterministic CI) but means an actual yt-dlp/extractor regression would only surface by manually running the `manual_*.py` scripts or using the app directly, never from `pytest`.
- `.claude/worktrees/yt-downloader-orchestration-2eca49` exists in the repo tree (gitignored) — apparent leftover from an earlier agent session's git worktree experiment. Never investigated or cleaned up; unclear if anything still references it.

## Inferences

Conclusions reached from evidence in the repo rather than being told directly — flagged so you can weigh how much to trust them:

- The 403/bot-detection root cause (stale cookies, not yt-dlp config) was inferred by live A/B testing two cookie files against identical code, not from any documentation or issue report that existed beforehand.
- `.claude/settings.local.json`'s permission allowlist (approved Bash commands from a past session) shows manual `--js-runtimes`/`--extractor-args` experimentation via the yt-dlp CLI directly — this is almost certainly where the reverted `player_client`/`js_runtimes` code change originated, i.e., a debugging experiment that got promoted into the codebase without being validated end-to-end first.
- `download_engine/downloader.py`'s `generate_filename()` has a `format_type == "subtitles"` branch that isn't wired to any caller elsewhere in the codebase (no `format_type="subtitles"` argument passed anywhere) — read as an in-progress, not-yet-integrated feature rather than dead code to remove.
- The actual GitHub remote name is `CLI-Video-Downloader` (matching the README's clone instructions) even though the local working directory on this machine is named `CLI-Downloader` — just a local folder rename, not a mismatch worth fixing.

## Decisions

Choices made this session that were mine to make (as opposed to the explicitly-confirmed items under "Things NOT to do without asking" above):

- One subfolder per playlist, not a full type-based reorganization (Videos/Shorts/Audio/Playlists) — the narrower change was explicitly chosen over the broader one when asked.
- `.claude/` and `.pytest_cache/` were added to `.gitignore` rather than deleted from disk — keeps them out of the repo without touching working state.
- The `extractor_args`/`player_client`/`js_runtimes` complexity was reverted rather than kept-and-fixed, once live testing showed it didn't affect outcomes either way — simpler code with equivalent behavior wins.
- The `.logged` exception-attribute marker was chosen over restructuring the exception class hierarchy, to keep the double-logging fix a small, targeted diff rather than a broader refactor.
- This architecture overview was written as `CLAUDE.md` at the repo root (auto-loaded by Claude Code) rather than as a `docs/architecture.md` reference file — an interpretation of "carry along to a new session," not something explicitly specified.
- User-facing error messages get the cause-plus-fix expansion; `errors.log` deliberately keeps the raw, unexpanded error — a scoping choice about where "friendliness" belongs versus where debugging precision matters more.

## For deeper history

`docs/agent-log/` has a chronological record of past changes, in case you need to understand *why* something is the way it is beyond what's captured above. Treat it as history, not current truth — always verify against the actual code.

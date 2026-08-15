# 001 — Codebase Audit

## Stack found
- Backend: Python (FastAPI + uvicorn), `yt-dlp` + FFmpeg for downloads, in-memory `JobManager` bridging blocking yt-dlp callbacks to asyncio queues, WebSocket for live progress.
- Persistence: flat JSON files under `backend/data/` — `download_history.json` (history) and `settings.json` (download location), no DB.
- Frontend: React + Vite + Tailwind, single-page app, talks to the backend over REST + WebSocket.
- Containerization: `Dockerfile`/`compose.yaml` build the **backend only** (Python 3.14-slim + ffmpeg + uv), plus a `bgutil-ytdlp-pot-provider` sidecar for YouTube PO tokens. The frontend is never containerized — it always runs natively via Vite.

## Continue-vs-restructure decision
**Continue in place — no restructure.** This is not a CLI-to-web-app port in progress; that migration was already completed in prior sessions (see git log: "added UI", "containerized the app", history/settings services already exist as proper backend modules separate from the original `backend/cli/` CLI entry point, which is preserved and untouched). The backend remains Python end to end. Nothing here warranted a rewrite.

## What was actually incomplete
The most recent commit ("Added custom download paths, not complete yet") turned out to be functionally complete on inspection and live testing:
- `backend/services/settings_service.py` + `backend/api/settings.py`: persists a user-chosen download directory, validates it's writable, and enforces (in Docker) that it matches the bind-mounted host path.
- `frontend/src/components/DownloadLocationDialog.tsx` + `SettingsView.tsx`: first-run setup dialog + change-location control in Settings.
- Verified live end-to-end: resolved a real YouTube URL, downloaded it, file landed on disk in the configured folder, history entry persisted and survived a page refresh, redownload-from-history worked.

No missing wiring was found — the "not complete yet" commit message was stale relative to the actual diff.

## Issue found
`README.md` and `.env.example` described an entirely different, no-longer-existing architecture: an Nginx reverse proxy terminating TLS via `mkcert` at `https://ytdownloader.local`, a `POT_PROVIDER_BASE_URL` env var, per-media-type download subfolders (`Single Videos/`, `Shorts/`, `Playlists/<title>/`), and a read-only `cookies.txt` bind mount. None of this matches `compose.yaml`/`Dockerfile` (backend-only container, no Nginx, no TLS) or `file_utils.py` (single flat download folder, no subfolders) or the actual writable `backend/config` bind mount. Following the documented Docker setup as written would have failed at the very first step (a `nginx/certs` directory that doesn't exist). Fixed — see [002](002-readme-env-doc-fix.md).

## Verification performed
- `uv sync` + backend import check: clean.
- `npm run build` (tsc + vite build): clean, no type errors.
- Started backend (uvicorn) + frontend (vite dev) locally, drove the UI in a real browser:
  - Pasted a real YouTube URL → resolved metadata (title, thumbnail, resolutions).
  - Started a download → completed, file verified on disk in the configured folder.
  - History entry appeared, persisted across a page reload, and "Redownload" successfully re-ran the job.
  - Invalid URL correctly rejected with a 422 and a clear error message.

## Remaining known limitations (unchanged, out of scope to fix)
- History/settings persistence is flat-JSON, single-process — fine for this app's local, single-user scope; no concurrent-write hardening was added since nothing in the goal calls for multi-user use.
- `SettingsView.tsx` "Open download folder after completion" checkbox is stored in `localStorage` but not wired to any actual folder-opening behavior — pre-existing, not part of the download-path feature, left as-is per scope discipline.

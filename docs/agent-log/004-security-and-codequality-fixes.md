# 004 — Address security/code-quality review report

A review report flagged several issues. Verified each against the actual current codebase before acting — the report's diff pointers didn't all match reality (see below) — then fixed what was real.

## Security

**CORS wildcard (`allow_origins=["*"]`)** — real, in `backend/api/main.py`. This is a locally-running server with no auth by design (the project's hard constraints explicitly exclude auth systems), which means any website open in the user's browser could otherwise silently call `/api/download`, `/api/cookies`, or history-deletion endpoints via JS (classic "attack against localhost"). Fixed by allowlisting only the frontend's own origins (`http://localhost:5173`, `http://127.0.0.1:5173`), overridable via `CORS_ALLOWED_ORIGINS` for non-default setups (`backend/config/settings.py`, wired through `compose.yaml` and documented in `.env.example`/README). This closes the actual browser-based attack vector without adding the auth system that's explicitly out of scope.

**Unauthenticated `/api/cookies` upload** — real. Did *not* add authentication (explicitly excluded from scope by the project brief), but added the input validation a trust boundary like this should always have regardless of auth: reject empty files, reject non-`.txt` filenames, cap size at 1 MiB (real Netscape cookie files are a few KB). Combined with the CORS fix, this closes the primary exploitable path (a malicious site's JS silently overwriting the user's cookies file) while keeping direct localhost access working for its intended purpose.

## Bugs

**yt-dlp `extractor_args` "regression"** — the report's diff shows changing from a nested `{"youtube": {"pot": {...}}}` structure to `{"youtubepot-bgutilhttp": {...}}`. Checked `backend/core/downloader.py`: the code has always used the nested `pot` structure; the described change was never made in this codebase (the diff doesn't correspond to any actual commit here). No action taken — verified instead, live, in an earlier session pass, that the current config downloads successfully end-to-end.

**Missing trailing newlines** — real, and more widespread than the two files the report named. Scanned all tracked text files and found 8 missing a final newline: `Dockerfile`, `backend/.dockerignore`, `backend/api/history.py`, `backend/api/settings.py`, `backend/services/settings_service.py`, `backend/utils/list_index.py`, `compose.yaml`, `frontend/src/components/DownloadLocationDialog.tsx`. Fixed all of them.

**CRLF line endings** — checked the actual git objects (`git show HEAD:<file>`), not the working-tree checkout: every file is stored as LF in the repository. The CRLF the report saw is Windows `core.autocrlf=true` converting on checkout — not a committed inconsistency, so there was nothing to "fix" in the files themselves. Added `.gitattributes` (`* text=auto eol=lf`) anyway since it's a one-line, zero-risk safeguard against someone accidentally committing CRLF in the future, which is what the report was actually worried about.

## Code quality

**`print()` instead of structured logging in `downloader.py`** — real. Added a module logger (matching the `logging.getLogger(__name__)` pattern already used in `jobs.py`/`settings_service.py`) and replaced the three `print()` calls. The cookies-path log (which echoes a full filesystem path) moved to `logger.debug`, so it's silent at the default `INFO` level and only appears when someone's actually debugging.

**`re` shadowing the `re` module in `api/main.py`** — real, in `_resolve()`'s playlist-entry matching loop. Renamed the loop variable to `raw_entry`.

## Verification
- Backend imports cleanly, 11 routes registered.
- `docker compose -f compose.yaml config` resolves correctly with the new optional `CORS_ALLOWED_ORIGINS` passthrough.
- `npm run build` (tsc + vite build) — clean.
- Live: CORS preflight from `http://localhost:5173` → allowed; from `http://evil.example` → no `access-control-allow-origin` header (browser blocks it).
- Live: `/api/cookies` — empty file → 400, wrong extension → 400, valid `.txt` → 200, 2 MB file → 413.

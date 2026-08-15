# 003 — Fix three review findings from PR #3

Three issues found in code review of the prior doc-fix PR:

**1. `bgutil-provider` vs `bgutil` naming mismatch**
The architecture diagram and its accompanying bullet called the Compose service `bgutil-provider`, but `compose.yaml` names it `bgutil` and the backend's `BGUTIL_BASE_URL=http://bgutil:4416` depends on that exact name for Docker DNS resolution. Fixed the README references; `compose.yaml`/`downloader.py` were already correct, no code change needed there.

**2. Frontend can't reach the backend by default**
`frontend/src/lib/api.ts` defaults `API_BASE_URL` to `''` when `VITE_API_BASE_URL` isn't set, so unconfigured `fetch`/WS calls hit the Vite dev server's own origin (5173) instead of the backend (8000) — resolve/download/history/WS all silently break, and the README never told users to configure `VITE_API_BASE_URL`. Rather than just adding a doc step, added a `server.proxy` block to `frontend/vite.config.ts` forwarding `/api` (with `ws: true`, since `/api/ws/*` needs WebSocket upgrades) and `/health` to `http://127.0.0.1:8000` — the default case now works with zero configuration. Documented the `VITE_API_BASE_URL` override in both README setup methods for the case where the backend isn't on the default port/host. Verified live: started backend on :8000, frontend dev server with no `.env` file at all, confirmed `/health` and `/api/history` both resolve correctly through the proxy.

**3. Ambiguous/unenforceable `DOWNLOADS_ROOT_HOST` default**
Docs said Compose defaults to `./Downloads` when `DOWNLOADS_ROOT_HOST` is unset, but that value is a relative path and the Settings API only accepts absolute paths — so a user following the "leave it unset" doc couldn't actually enter the value the app was using. Worse, when unset the container gets an *empty string* for `DOWNLOADS_ROOT_HOST`, and empty-string is falsy in the `HOST_DOWNLOADS_ROOT is not None` check in `settings_service.py`, so Docker-mode enforcement silently no-ops — any absolute path a user typed would be accepted even if it didn't match the real bind mount. Made `DOWNLOADS_ROOT_HOST` genuinely required: `compose.yaml` now uses `${DOWNLOADS_ROOT_HOST:?...}` on both the `environment` and `volumes` entries, so `docker compose up` fails fast with a clear message instead of starting in a silently-misconfigured state. Updated `.env.example` and the README Docker walkthrough to say it's required, not optional. No changes needed in `settings_service.py` itself — the enforcement logic was already correct, it just needed `HOST_DOWNLOADS_ROOT` to never be unset in Docker.

## Verification
- `docker compose -f compose.yaml config` — fails with the intended error when `DOWNLOADS_ROOT_HOST` is unset; resolves correctly when set.
- `npm run build` (tsc + vite build) — clean.
- Live: backend on default port 8000, frontend dev server started with no `.env`/`VITE_API_BASE_URL` anywhere — `/health` and `/api/history` both returned 200 through the new proxy.

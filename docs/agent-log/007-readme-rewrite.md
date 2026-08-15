# 007 - Rewrite README as a real project README, not a documentation dump

The README had grown into a step-by-step ops runbook (numbered Docker methods, a troubleshooting table, an inline architecture diagram) without ever answering "what is this and why would I use it" up front. Rewrote it around five questions: what is this, what can it do, how do I install it, how do I use it, how is it structured. No emojis, no em or en dashes.

## What changed
- Leads with identity and a one-line description, not installation.
- Features list only what actually exists (verified against the code, not the original feature aspirations).
- Split CLI and Web App usage into their own subsections, since the project genuinely has both interfaces.
- Added Tech Stack, Supported Downloads and Download History as their own short sections instead of folding them into prose.
- Project Structure documents the meaningful directory boundaries (backend/core is the engine, backend/api and backend/cli are the two interfaces on top of it), not a full file listing.
- Configuration table separates what a user actually sets (`DOWNLOADS_ROOT_HOST`, `CORS_ALLOWED_ORIGINS`, `VITE_API_BASE_URL`) from what Compose sets automatically (`DOWNLOADS_ROOT`, `BGUTIL_BASE_URL`), which the old README didn't distinguish.
- Docker gets its own short section instead of being interleaved into a two-method setup walkthrough.
- Development section is intentionally thin: clone, install, run, build and lint before submitting. Points to `docs/agent-log/` for the why behind past decisions instead of duplicating it.
- Added a License section (there is no LICENSE file in the repo, said so honestly rather than inventing one) and a short Disclaimer.

## A real bug this caught
Testing the CLI usage section as written surfaced a real gap: `backend/main.py` (the CLI) calls into the same `settings_service` as the web app, so on a completely fresh checkout with no `backend/data/settings.json`, the CLI fails immediately with `DownloadLocationRequiredError` even though nothing in the CLI's own code or prompts mentions a "download location" concept. Confirmed this live (ran the documented command against a fresh checkout, got the error; created `backend/data/settings.json` with a valid path, reran, got a successful MP3 download). The CLI Usage section now says this explicitly, since documenting the command without this caveat would have sent a CLI-only user straight into a confusing error with no explanation in view.

## Verification
- CLI command as documented: failed on a fresh checkout (expected, now documented), succeeded once a location was configured, file confirmed on disk.
- Web app commands (`uv run python backend/run_api.py`, `npm run dev`) run exactly as documented; health check and Vite proxy confirmed.
- `npm run build` and `npm run lint` both run clean (lint has a handful of pre-existing warnings, no errors, unrelated to this change).
- Scanned the file for em dashes, en dashes, and emoji/pictograph code points: none found. Box-drawing characters in the two ASCII diagrams are the only non-ASCII content.

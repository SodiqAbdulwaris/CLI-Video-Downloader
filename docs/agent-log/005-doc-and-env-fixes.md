# 005 — Fix Qodo findings from PR #3 and PR #4

Two real findings surfaced by Qodo's re-review, both still live on `agent-integration` (Qodo's bgutil-naming finding on the same PR was already marked ✓ Resolved from #4 — no action needed there).

**1. `.env.example`'s `${HOME}/Downloads` default silently breaks on native Windows**
Docker Compose's `--env-file` loading does interpolate `${VAR}` references against the surrounding process environment — verified this live rather than trusting the report: with `HOME` unset and `DOWNLOADS_ROOT_HOST=${HOME}/Downloads` in the `.env` file, `docker compose config` resolved it to `/Downloads` (empty `HOME` + literal suffix), not an error, not the user's real folder. Confirmed `HOME` is genuinely unset in native Windows PowerShell (only `USERPROFILE` exists there) — the exact shell the README's own "Windows (PowerShell)" instructions tell users to run. So a Windows user copying `.env.example` verbatim and running `docker compose up` gets a silently wrong download location, no error at all.

Fixed by removing the active `DOWNLOADS_ROOT_HOST=` assignment from `.env.example` entirely, leaving only commented OS-specific examples the user must uncomment and fill in themselves. Combined with the `${VAR:?...}` requirement already added in #004, a fresh `cp .env.example .env` now fails loudly and clearly at `docker compose up` instead of silently pointing at the wrong folder — verified live.

**2. README troubleshooting table conflated two different errors**
The table's "A download location has not been configured" row claimed a Docker bind-mount mismatch could also produce that message. It can't: in Docker mode `get_target_download_dir()` always resolves to the container's `/downloads` mount, so `DownloadLocationRequiredError` never fires there — a mismatch instead raises a distinct `SettingsError` with its own message (see `settings_service.py`'s `update_download_directory`). Split into two accurate rows so Docker users hitting a mismatch aren't sent looking for the wrong error message.

## Verification
- `docker compose --env-file <fresh-copy-of-.env.example> -f compose.yaml config` fails with the intended `DOWNLOADS_ROOT_HOST` error message (nothing to unset — the file has no default line to accidentally trigger the old bug).
- `docker compose -f compose.yaml config` still resolves correctly when `DOWNLOADS_ROOT_HOST` is set to a real path.

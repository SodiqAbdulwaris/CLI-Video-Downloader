# 002 — README / .env.example doc fix

**What**: Rewrote stale documentation describing a removed Nginx + mkcert + TLS Docker topology, and a per-media-type folder layout that no longer exists.

**Why**: The setup steps as written were unfollowable (referenced a nonexistent `nginx/certs` directory) and misdescribed both the Docker topology (backend-only container, no Nginx) and the download folder layout (single flat folder, chosen in-app, not `Downloads/YT-Video Downloader/{Single Videos,Shorts,Playlists}/`). Left as-is, it would actively mislead anyone following the Definition of Done's "one or two clearly documented start commands."

**Where**: `README.md` (Features, Storage Organization, Prerequisites, full Docker walkthrough, architecture diagram, Troubleshooting), `.env.example` (dropped `LOCAL_HOSTNAME`/`POT_PROVIDER_BASE_URL`, fixed the folder-layout comment).

**Trade-offs**: Doc-only, no code/behavior change — done directly by Claude (no delegation needed for a documentation pass); done directly against the working branch rather than via a separate feature-branch/PR cycle, since the app was already functionally complete and this was the only outstanding item (see [001](001-codebase-audit.md)).

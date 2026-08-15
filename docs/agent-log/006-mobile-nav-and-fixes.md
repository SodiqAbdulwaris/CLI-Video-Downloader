# 006 — Recover and integrate real work found staged in the primary worktree

While reviewing local uncommitted changes per the user's request, found the primary worktree's `main` checkout (separate from this session's worktree) had ~2000 lines staged. Diffing with `--ignore-all-space --ignore-blank-lines` per file separated genuine content changes from CRLF line-ending noise: 25 of 32 files were pure noise (zero real diff), 7 had real, deliberate, already-finished work of unknown origin (not from this session).

Rather than commit that work directly onto the primary worktree's stale, 15-commits-behind local `main` (which would have meant pushing straight to `origin/main`, bypassing the branch+PR+review workflow this whole session has used), the real changes were manually re-applied on a fresh branch off the current `agent-integration`, verified byte-identical to the original (`diff` against the staged blobs, ignoring CRLF), built/typechecked clean, then committed and PR'd normally.

## What was recovered
- **`backend/core/downloader.py`**: fixed the yt-dlp `extractor_args` structure for the bgutil PO-token provider — `{"youtube": {"pot": {...}}}` → `{"youtubepot-bgutilhttp": {"base_url": [bgutil_url]}}`. Matches a finding from an earlier Qodo review questioning whether the old nested structure was correct for the installed plugin.
- **`frontend/src/hooks/useDownloadSocket.ts`**: bugfix — items still mid-flight (downloading/queued) when a job fails never received their own "failed" item event, leaving their progress UI spinning forever. Now marked failed alongside the job.
- **Mobile nav redesign** (`App.tsx`, `Header.tsx`, `Sidebar.tsx`, new `BottomNav.tsx`): replaces the old slide-in mobile drawer + hamburger button with a persistent bottom tab bar (Download/Downloads/History/Settings), matching the common mobile-app nav pattern. `Sidebar` is now desktop-only (`hidden md:block`), `mobileOpen` state removed entirely from `App.tsx`.
- **`SettingsView.tsx`/`Header.tsx`**: shortened "Application Settings" → "Settings" heading text (2 places).

## What was deliberately excluded
`SettingsView.tsx` also had `dark:text-amber-300` dropped from the cookies security-notice box's className, isolated from every other change in that diff (no other dark-mode styling was touched anywhere else in the changeset). Read as an accidental edit — dropping it would leave that notice with worse contrast in dark mode — so it was not carried over. Flagged to the user for their own check.

## Verification
- Backend imports clean, frontend `tsc -b && vite build` clean, no type errors.
- Resized to a mobile viewport (375×812): confirmed 4 bottom-nav buttons render and the old hamburger button is gone; zero console errors on a fresh load through the Vite dev proxy.
- Full click-through interaction testing was blocked by a Browser-pane rendering issue in the tooling itself (not app-related) — structural/build verification stood in for it.

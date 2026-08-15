# 008: Track docs/agent-log/ in git

Retroactive entry. This work happened as PR #7 but was never logged at the time.

`.gitignore` had a blanket `docs/` rule from before this session, which silently ignored every `docs/agent-log/*.md` entry created so far. The original task brief explicitly required this folder to exist in the repository as a documentation trail. With the blanket ignore in place, none of it was ever actually committed; it only existed in the local worktree.

Changed the rule from `docs/` to `docs/*` plus `!docs/agent-log/`. A plain `!docs/agent-log/` on its own does not work: once git excludes a whole directory, it will not look inside that directory for negation patterns, so the parent exclusion has to be narrowed to `docs/*` first. Committed the five agent-log entries that existed at that point (001 through 005).

Also cleaned up, but did not commit, several gitignored files left over from live testing earlier in the session: fake download history and settings pointing at a temp test directory, a test `cookies.txt`, and an abandoned partial `.venv-check` directory from an earlier dependency-install attempt. None of these were tracked, so there was nothing to remove from git; they were just local clutter.

## Verification
- `git status docs/` confirmed the log files were tracked, not ignored, after the change.
- No functional or code changes; docs and `.gitignore` only.
- Bot review on PR #7: Graphify, no blocking issues. Qodo, no issues found.

# 009: Fix cookies notice contrast in dark mode

Retroactive entry. This work happened as PR #10 but was never logged at the time.

The cookies security notice in Settings originally used `text-amber-700 dark:text-amber-300`. Earlier work (PR #9) had dropped the `dark:` override entirely, on the stated reasoning that it made the notice hard to read in light mode. That reasoning did not hold up: a `dark:` variant in Tailwind only applies inside the `.dark` class scope, so it cannot affect light-mode rendering at all. Whatever readability problem was observed, it was not caused by that class.

Verified this with actual numbers instead of arguing from theory. Resolved each color to RGB with a canvas element (Tailwind v4 reports colors in `oklch()`, which `getComputedStyle` does not resolve to RGB on its own) and computed WCAG contrast ratios against the rendered card background in both themes:

| State | Text color | Background | Contrast | WCAG AA (4.5 minimum) |
|---|---|---|---|---|
| Light mode, `text-amber-700` (unaffected by the change either way) | `#bb4d00` | white | 5.03 | pass |
| Dark mode, original `dark:text-amber-300` | `#fcd34d` | near-black card | 12.86 | pass, strong |
| Dark mode, after the override was dropped | `#bb4d00` | near-black card | 3.69 | fail |

Removing the override made dark mode measurably worse, not better, and could not have touched light mode at all. Qodo's review of PR #9 flagged the same regression independently.

Settled on `dark:text-amber-400` (11.11 contrast) rather than restoring the original `dark:text-amber-300`, since `text-amber-400` is the convention already used by `DownloadStatusBadge.tsx` and `DownloadCompleteDialog.tsx` for the same `bg-amber-500/10` pattern elsewhere in the app.

## Verification
- `npm run build` clean after each of the two commits on this branch.
- Contrast ratios computed live in a running instance of the app, not estimated.
- Qodo's review after the final commit: 0 bugs, 0 issues.

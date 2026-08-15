# 012: Add LICENSE and CONTRIBUTING.md

The README's License section had said, accurately at the time, that no license file existed. Asked to add one and pick whichever fits best.

Chose MIT over Apache 2.0 or another option. Every dependency this project actually uses is already permissively licensed and compatible: yt-dlp is Unlicense (public domain), FastAPI, React, and Tailwind CSS are all MIT. Apache 2.0's main advantage over MIT is its explicit patent grant, which matters for projects with meaningful patent exposure or many external contributors; this is a small, single-purpose tool without that concern, so the extra length and complexity of Apache 2.0 wasn't worth it. MIT is also the license most people expect by default for a project this size, which lowers friction for anyone deciding whether to use or contribute to it.

Updated the README's License section to point at the new `LICENSE` file instead of saying none exists.

Also added `CONTRIBUTING.md`, since a license alone doesn't tell someone how to actually contribute. Kept it short and specific to what this project actually has: how to get set up (points back to the README rather than duplicating it), the two checks that actually exist (`npm run build`, `npm run lint`, since there's no backend test suite yet), what to include in a bug report, and a reminder to keep pull requests focused and to update the README in the same PR when a change affects documented behavior. Deliberately did not invent a code of conduct, issue templates, or a formal review process the project doesn't have.

## Verification
- Scanned both new files and the README diff for em dashes, en dashes, and emoji: none found.
- `LICENSE` uses the standard, unmodified MIT license text.

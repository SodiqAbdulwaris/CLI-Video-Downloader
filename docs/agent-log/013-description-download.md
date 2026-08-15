# 013: Save the video description alongside downloaded files

Requested feature: get the video's description along with the video, since some videos put important information there (links, timestamps, credits) that would otherwise be lost.

yt-dlp already includes the description in the info dict returned by `fetch_info`, no extra extraction or request needed. Confirmed this live before building anything: fetched a real video's info and printed `info.get("description")`, got the actual multi-line description text back, links and timestamps included.

Added a `_save_description` method to `VideoDownloader` in `backend/core/downloader.py` and called it from all three places `_download_once` finishes writing a file: the audio-only path, the merged video+audio path, and the plain progressive-download path. All three already had access to `info` and `final_path`, so this needed no new parameters threaded through. Writes a plain text file named after the downloaded file with `.description.txt` appended, for example `My Video.mp4` alongside `My Video.description.txt`, using `final_path.with_name(...)` rather than `with_suffix()` to avoid any ambiguity with a suffix containing a dot. Skips writing anything when a video has no description, rather than creating an empty file every time.

This applies automatically to the CLI, the web app, and playlist downloads without any extra changes, since all three call into the same `download()` to `_download_once()` path. No toggle or setting was added to turn it off; the feature was requested as something that happens by default when downloading, matching the project's convention of not adding configuration surface beyond what's asked for.

## Verification
- Live test: video info fetch returned a real description before any code was written, confirming the field is actually populated.
- Progressive-format download (240p): `.description.txt` written with content matching the source exactly.
- Audio-only download: same.
- Merged video+audio download (1080p, required an FFmpeg merge): same, on a different, larger real video to make sure the merged code path was actually exercised and not just assumed safe by inspection.
- Backend still imports cleanly after the change.
- Updated the README's Features list and Supported Downloads section to describe the new file and its naming pattern.

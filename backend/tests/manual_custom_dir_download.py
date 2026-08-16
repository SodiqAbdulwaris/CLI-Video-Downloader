"""Live integration check: set a custom download directory via the real
SettingsService, download a real video through VideoDownloader, and verify
the file lands in that directory. Hits the network and YouTube for real.

Run with: uv run python backend/tests/manual_custom_dir_download.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.downloader import VideoDownloader
from services.settings_service import settings_service

TARGET_DIR = r"C:\Users\HP\S.A Stuffs\MyWorks\Projects\CLI Video Downloader"
URL = "https://youtube.com/watch?v=C842vFY5kRo"

# Optional: point at a different cookies.txt for this run only (does not
# touch backend/config/cookies.txt). Useful to isolate "does the custom
# download directory work" from "are the app's cookies still fresh".
COOKIES_OVERRIDE = sys.argv[1] if len(sys.argv) > 1 else None


def main() -> int:
    original = settings_service.get_download_directory()
    print(f"Original configured download directory: {original!r}")

    print(f"Setting download directory to: {TARGET_DIR}")
    settings_service.update_download_directory(TARGET_DIR)

    try:
        downloader = VideoDownloader()
        if COOKIES_OVERRIDE:
            print(f"Using cookies override for this run: {COOKIES_OVERRIDE}")
            downloader._base_options["cookiefile"] = COOKIES_OVERRIDE
        listing = downloader.fetch_playlist_listing(URL)
        media_type = downloader.detect_type(listing)
        info = downloader.fetch_info(URL) if media_type != "playlist" else listing
        title = info.get("title") or "video"
        print(f"Resolved: {title!r} (type={media_type})")

        final_path = downloader.download(
            url=URL,
            selection=None,
            download_path=None,  # forces resolve_output_path() -> the setting above
            media_type=media_type,
            preferred_resolution="360p",
            format_type="video",
        )

        target_dir_resolved = Path(TARGET_DIR).resolve()
        ok_location = final_path.resolve().parent == target_dir_resolved
        ok_exists = final_path.exists() and final_path.stat().st_size > 0

        print(f"Downloaded to: {final_path}")
        print(f"File size: {final_path.stat().st_size if final_path.exists() else 0} bytes")
        print(f"Landed in configured custom directory: {ok_location}")
        print(f"File exists and is non-empty: {ok_exists}")

        return 0 if (ok_location and ok_exists) else 1
    finally:
        if original is not None:
            print(f"Restoring original download directory: {original!r}")
            settings_service.update_download_directory(original)
        else:
            print("No original directory was configured; leaving the new one in place.")


if __name__ == "__main__":
    raise SystemExit(main())

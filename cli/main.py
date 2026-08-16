from __future__ import annotations

import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from cli.interface import (
    display_playlist_info,
    display_video_info,
    prompt_format_type,
    prompt_playlist_choice,
    prompt_resolution,
    prompt_url,
)
from download_engine.config import DEFAULT_RESOLUTION_PRIORITY
from download_engine.downloader import VideoDownloader, VideoDownloaderError
from download_engine.ffmpeg import check_ffmpeg
from download_engine.file_utils import ensure_directory
from download_engine.logging_utils import log_error
from download_engine.playlist import PlaylistSelectionError, get_playlist_entries
from download_engine.validators import is_valid_url

# The CLI shares its download location with the web app's Settings, Download
# Location (see README) rather than duplicating that config — it just reads
# the same file the backend's SettingsService writes.
_SETTINGS_FILE = _REPO_ROOT / "backend" / "data" / "settings.json"


def _resolve_download_directory() -> Path:
    directory = None
    try:
        data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
        directory = data.get("download_directory")
    except (OSError, json.JSONDecodeError):
        pass
    if not directory:
        raise VideoDownloaderError(
            "No download location is configured yet. Start the web app once and set "
            "one from Settings, Download Location — the CLI shares that same setting."
        )
    return ensure_directory(Path(directory))


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else prompt_url()
    if not is_valid_url(url):
        print("Error: Please provide a valid http or https URL.")
        log_error(
            url=url,
            media_type="Unknown",
            resolution="N/A",
            format_type="N/A",
            codec="N/A",
            download_path="N/A",
            filename="N/A",
            error_message="Invalid URL provided by user.",
        )
        return 1

    try:
        check_ffmpeg()
        download_path = _resolve_download_directory()
        downloader = VideoDownloader()
        listing_info = downloader.fetch_playlist_listing(url)
        media_type = downloader.detect_type(listing_info)
        info = listing_info if media_type == "playlist" else downloader.fetch_info(url)

        if media_type == "playlist":
            entries = get_playlist_entries(info)
            display_playlist_info(info, entries)
            playlist_mode, selected_indices = prompt_playlist_choice(len(entries))
            available_resolutions = downloader.get_playlist_resolutions(entries)
            resolution = prompt_resolution(
                available_resolutions,
                DEFAULT_RESOLUTION_PRIORITY,
                allow_auto=True,
            )
            format_type = prompt_format_type()
            if playlist_mode == "full":
                selected_indices = list(range(len(entries)))

            result = downloader.download_playlist(
                url=url,
                indices=selected_indices,
                resolution=resolution,
                format_type=format_type,
                download_path=download_path,
                playlist_info=info,
            )
            print(
                f"Completed playlist download. Success: {result.completed} | Failed: {result.failed}"
            )
            if result.failures:
                print("Some playlist items failed. Check errors.log for details.")
            return 0 if result.failed == 0 else 1

        display_video_info(info, downloader.get_formats(info), media_type)
        resolution = prompt_resolution(
            downloader.list_available_resolutions(info),
            DEFAULT_RESOLUTION_PRIORITY,
            allow_auto=True,
        )
        format_type = prompt_format_type()
        final_path = downloader.download(
            url=url,
            selection=None,
            download_path=download_path,
            media_type=media_type,
            preferred_resolution=resolution,
            format_type=format_type,
        )
        print(f"Saved to: {final_path}")
        return 0
    except (VideoDownloaderError, PlaylistSelectionError) as exc:
        print(f"Error: {exc}")
        return 1
    except KeyboardInterrupt:
        print("\nCancelled by user.")
        return 1
    except Exception as exc:  # pragma: no cover
        print(f"Unexpected error: {exc}")
        log_error(
            url=url,
            media_type="Unknown",
            resolution="N/A",
            format_type="N/A",
            codec="N/A",
            download_path="N/A",
            filename="N/A",
            error_message=str(exc),
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

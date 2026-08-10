from __future__ import annotations

import sys

from cli.interface import (
    display_playlist_info,
    display_video_info,
    prompt_format_type,
    prompt_playlist_choice,
    prompt_resolution,
    prompt_url,
)
from config.settings import DEFAULT_RESOLUTION_PRIORITY
from core.downloader import VideoDownloader, VideoDownloaderError
from core.playlist import PlaylistSelectionError, get_playlist_entries
from utils.logging_utils import log_error
from utils.system import check_dependencies
from utils.validators import is_valid_url


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
        check_dependencies()
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
            download_path=None,
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

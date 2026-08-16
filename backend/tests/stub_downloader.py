"""A VideoDownloader that keeps all real orchestration logic (retry, error
logging, playlist status, filename generation) but replaces the actual
network boundary — fetch_info/fetch_playlist_listing/_download_stream —
with canned, in-memory responses. Shared by the integration tests so they
never touch the network.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yt_dlp

from core.downloader import VideoDownloader


class StubVideoDownloader(VideoDownloader):
    def __init__(self, responses: dict[str, Any], fail_urls: set[str] | None = None):
        super().__init__()
        self._responses = responses
        self._fail_urls = fail_urls or set()

    def fetch_info(self, url: str) -> dict[str, Any]:
        return self._responses[url]

    def fetch_playlist_listing(self, url: str) -> dict[str, Any]:
        return self._responses[url]

    def _download_stream(self, url, format_selector, output_prefix, title, progress_hook=None) -> Path:
        if url in self._fail_urls:
            raise yt_dlp.utils.DownloadError("ERROR: unable to download video data: HTTP Error 403: Forbidden")
        out_path = output_prefix.with_suffix(".mp4")
        out_path.write_bytes(b"fake video bytes")
        return out_path


def video_info(title: str, video_id: str = "vid1") -> dict[str, Any]:
    return {
        "title": title,
        "webpage_url": f"https://www.youtube.com/watch?v={video_id}",
        "description": "A test description.",
        "duration": 120,
        "formats": [
            {
                "format_id": "18",
                "ext": "mp4",
                "vcodec": "avc1.42001E",
                "acodec": "mp4a.40.2",
                "height": 360,
                "width": 640,
                "abr": 96,
            }
        ],
    }


def playlist_info(title: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {"_type": "playlist", "title": title, "entries": entries}

from unittest.mock import patch

from api.main import _resolve


def test_resolve_playlist_matches_thumbnails_by_url_and_title_fallback():
    listing_info = {
        "title": "My Playlist",
        "webpage_url": "https://www.youtube.com/playlist?list=PL1",
        "entries": [
            {"title": "Dup Title", "webpage_url": "https://x/1", "thumbnails": [{"url": "thumb1"}]},
            {"title": "Dup Title", "webpage_url": "https://x/2", "thumbnails": [{"url": "thumb2"}]},
            # No webpage_url/original_url/url — only a raw id, as some flat
            # extractors emit. get_playlist_entries() still synthesizes a
            # watch URL for it, but _resolve() has nothing to match by url,
            # so it must fall back to matching on title.
            {"title": "Unique, no url match", "id": "raw3", "ie_key": "Youtube", "thumbnails": [{"url": "thumb3"}]},
        ],
    }

    class StubDownloader:
        def __init__(self):
            pass

        def fetch_playlist_listing(self, url):
            return listing_info

        def detect_type(self, info):
            return "playlist"

        def get_playlist_resolutions(self, entries):
            return ["720p"]

    with patch("api.main.VideoDownloader", StubDownloader):
        result = _resolve("https://playlist-url")

    entries = result["entries"]
    assert len(entries) == 3
    # Duplicate titles are disambiguated by webpage_url, not just title match.
    assert entries[0]["thumbnail"] == "thumb1"
    assert entries[1]["thumbnail"] == "thumb2"
    # Third entry has no webpage_url; falls back to title-based match.
    assert entries[2]["thumbnail"] == "thumb3"

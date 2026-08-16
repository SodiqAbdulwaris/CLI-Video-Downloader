from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode, urlparse


class PlaylistSelectionError(ValueError):
    pass


@dataclass(slots=True)
class PlaylistEntry:
    index: int
    title: str
    url: str
    duration: int | None


def is_playlist(info: dict[str, Any]) -> bool:
    return info.get("_type") == "playlist" or bool(info.get("entries"))


def get_playlist_entries(info: dict[str, Any]) -> list[PlaylistEntry]:
    entries: list[PlaylistEntry] = []
    for position, entry in enumerate(info.get("entries") or [], start=1):
        if not entry:
            continue
        url = _entry_url(info, entry)
        if not url:
            continue
        entries.append(
            PlaylistEntry(
                index=int(entry.get("playlist_index") or entry.get("index") or position),
                title=str(entry.get("title") or f"Video {position}"),
                url=str(url),
                duration=entry.get("duration"),
            )
        )
    return entries


def _entry_url(playlist_info: dict[str, Any], entry: dict[str, Any]) -> str:
    """Get a downloadable URL from fields available in a flat yt-dlp playlist entry."""
    for key in ("webpage_url", "original_url", "url"):
        value = entry.get(key)
        if isinstance(value, str) and urlparse(value).scheme in {"http", "https"}:
            return value

    video_id = entry.get("id") or entry.get("url")
    extractor = str(entry.get("ie_key") or entry.get("extractor_key") or "").lower()
    playlist_host = urlparse(str(playlist_info.get("webpage_url") or "")).netloc.lower()
    if video_id and ("youtube" in extractor or playlist_host.endswith("youtube.com")):
        return f"https://www.youtube.com/watch?{urlencode({'v': str(video_id)})}"
    return ""


def parse_selection(selection_str: str, total: int) -> list[int]:
    if not selection_str.strip():
        raise PlaylistSelectionError("Please enter at least one playlist index.")

    selected: set[int] = set()
    for chunk in selection_str.split(","):
        part = chunk.strip()
        if not part:
            continue
        if "-" in part:
            bounds = [piece.strip() for piece in part.split("-", maxsplit=1)]
            if len(bounds) != 2 or not all(item.isdigit() for item in bounds):
                raise PlaylistSelectionError(f"Invalid range: {part}")
            start, end = (int(bounds[0]), int(bounds[1]))
            if start > end:
                raise PlaylistSelectionError(f"Invalid range: {part}")
            _ensure_index(start, total)
            _ensure_index(end, total)
            for value in range(start, end + 1):
                selected.add(value - 1)
            continue

        if not part.isdigit():
            raise PlaylistSelectionError(f"Invalid index: {part}")
        index = int(part)
        _ensure_index(index, total)
        selected.add(index - 1)

    if not selected:
        raise PlaylistSelectionError("No valid playlist indices were selected.")
    return sorted(selected)


def _ensure_index(index: int, total: int) -> None:
    if index < 1 or index > total:
        raise PlaylistSelectionError(
            f"Index {index} is out of range. Choose values between 1 and {total}."
        )

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


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
        url = entry.get("webpage_url") or entry.get("url") or ""
        if not url:
            continue
        entries.append(
            PlaylistEntry(
                index=position,
                title=str(entry.get("title") or f"Video {position}"),
                url=str(url),
                duration=entry.get("duration"),
            )
        )
    return entries


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

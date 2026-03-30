from __future__ import annotations

from core.formats import FormatOption
from core.playlist import PlaylistEntry, PlaylistSelectionError, parse_selection


def prompt_url() -> str:
    return input("Enter Video URL: ").strip()


def display_video_info(info: dict, formats: list[FormatOption], media_type: str) -> None:
    title = info.get("title") or "Unknown title"
    duration = _format_duration(info.get("duration"))
    print(f"Title: {title}")
    print(f"Duration: {duration}")
    print(f"Type: {'Short' if media_type == 'short' else 'Video'}")
    resolutions = sorted(
        {fmt.resolution for fmt in formats if fmt.height > 0},
        key=lambda item: int(item[:-1]) if item.endswith("p") and item[:-1].isdigit() else 0,
        reverse=True,
    )
    print("Available resolutions: " + (", ".join(resolutions) if resolutions else "Unknown"))


def display_playlist_info(info: dict, entries: list[PlaylistEntry]) -> None:
    print(f"Playlist title: {info.get('title') or 'Unknown playlist'}")
    print(f"Number of videos: {len(entries)}")
    for entry in entries:
        duration = _format_duration(entry.duration)
        print(f"{entry.index}. {entry.title} | {duration}")


def prompt_resolution(
    available: list[str], default_priority: list[str], allow_auto: bool = True
) -> str | None:
    if available:
        print("Available resolutions:")
        for resolution in available:
            print(f"- {resolution}")
    default_label = " -> ".join(default_priority)
    while True:
        selected = input(
            f"Select resolution (or press Enter for auto: {default_label} -> best): "
        ).strip().lower()
        if not selected and allow_auto:
            return None
        normalized = selected.rstrip("p")
        if normalized.isdigit():
            selected = f"{normalized}p"
        if selected in available:
            return selected
        print("Invalid resolution. Choose one from the list or press Enter for auto.")


def prompt_format_type() -> str:
    while True:
        choice = input("Download format? (1) Video (2) Audio only: ").strip()
        if choice == "1":
            return "video"
        if choice == "2":
            return "audio"
        print("Invalid choice. Enter 1 or 2.")


def prompt_playlist_choice(total: int) -> tuple[str, list[int]]:
    while True:
        choice = input(
            "Download full playlist or select specific videos? (full/select): "
        ).strip().lower()
        if choice == "full":
            return "full", list(range(total))
        if choice == "select":
            selection = input(
                "Enter video numbers (e.g., 1,3,5 or 1-5 or 1,3-7,10): "
            ).strip()
            try:
                return "select", parse_selection(selection, total)
            except PlaylistSelectionError as exc:
                print(exc)
                continue
        print("Invalid choice. Enter 'full' or 'select'.")


def _format_duration(seconds: int | None) -> str:
    if seconds is None:
        return "Unknown"
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

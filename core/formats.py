from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config.settings import DEFAULT_RESOLUTION_PRIORITY


@dataclass(slots=True)
class FormatOption:
    format_id: str
    resolution: str
    ext: str
    video_codec: str
    audio_codec: str
    bitrate_kbps: int | None
    height: int
    width: int
    is_progressive: bool
    is_video_only: bool
    is_audio_only: bool
    preference_rank: int


@dataclass(slots=True)
class FormatSelection:
    resolution: str
    format_type: str
    container_extension: str
    video_format_id: str | None
    audio_format_id: str | None
    merged: bool
    video_codec: str
    audio_codec: str
    audio_bitrate_kbps: int | None

    @property
    def codec_label(self) -> str:
        if self.format_type == "audio":
            bitrate = (
                f"{self.audio_bitrate_kbps}kbps" if self.audio_bitrate_kbps else "unknown"
            )
            return f"{self.audio_codec}_{bitrate}"
        return f"{self.video_codec}+{self.audio_codec}"


def normalize_formats(info: dict[str, Any]) -> list[FormatOption]:
    options: list[FormatOption] = []
    for raw in info.get("formats", []):
        format_id = raw.get("format_id")
        if not format_id:
            continue

        video_codec = _normalize_codec(raw.get("vcodec"))
        audio_codec = _normalize_codec(raw.get("acodec"))
        ext = str(raw.get("ext") or "bin")
        height = int(raw.get("height") or 0)
        width = int(raw.get("width") or 0)
        resolution = _resolution_label(raw, height)
        bitrate = _audio_bitrate(raw)
        is_video_only = video_codec != "none" and audio_codec == "none"
        is_audio_only = video_codec == "none" and audio_codec != "none"
        is_progressive = video_codec != "none" and audio_codec != "none"

        options.append(
            FormatOption(
                format_id=str(format_id),
                resolution=resolution,
                ext=ext,
                video_codec=video_codec,
                audio_codec=audio_codec,
                bitrate_kbps=bitrate,
                height=height,
                width=width,
                is_progressive=is_progressive,
                is_video_only=is_video_only,
                is_audio_only=is_audio_only,
                preference_rank=_preference_rank(ext, is_progressive),
            )
        )
    return options


def list_resolutions(formats: list[FormatOption]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for fmt in sorted(formats, key=lambda item: (-item.height, item.ext, item.format_id)):
        if fmt.height <= 0:
            continue
        if fmt.resolution not in seen:
            seen.add(fmt.resolution)
            ordered.append(fmt.resolution)
    return ordered


def select_format(
    formats: list[FormatOption],
    preferred_resolution: str | None,
    format_type: str,
) -> FormatSelection:
    if format_type == "audio":
        return _select_audio_only(formats)

    video_streams = [fmt for fmt in formats if not fmt.is_audio_only and fmt.video_codec != "none"]
    if not video_streams:
        raise ValueError("No downloadable video formats were found.")

    priorities = _resolution_candidates(preferred_resolution, formats)
    for resolution in priorities:
        selected = _select_video_for_resolution(formats, resolution)
        if selected is not None:
            return selected

    raise ValueError("Unable to choose a compatible video format.")


def _select_video_for_resolution(
    formats: list[FormatOption], resolution: str
) -> FormatSelection | None:
    exact = [fmt for fmt in formats if fmt.resolution == resolution]
    progressive = [fmt for fmt in exact if fmt.is_progressive]
    mp4_progressive = [fmt for fmt in progressive if fmt.ext == "mp4"]

    if mp4_progressive:
        best = sorted(
            mp4_progressive,
            key=lambda item: (-item.height, item.preference_rank, item.bitrate_kbps or 0),
        )[0]
        return FormatSelection(
            resolution=best.resolution,
            format_type="video",
            container_extension=best.ext,
            video_format_id=best.format_id,
            audio_format_id=None,
            merged=False,
            video_codec=best.video_codec,
            audio_codec=best.audio_codec,
            audio_bitrate_kbps=best.bitrate_kbps,
        )

    if progressive:
        best = sorted(
            progressive,
            key=lambda item: (-item.height, item.preference_rank, item.bitrate_kbps or 0),
        )[0]
        return FormatSelection(
            resolution=best.resolution,
            format_type="video",
            container_extension=best.ext,
            video_format_id=best.format_id,
            audio_format_id=None,
            merged=False,
            video_codec=best.video_codec,
            audio_codec=best.audio_codec,
            audio_bitrate_kbps=best.bitrate_kbps,
        )

    video_only = [fmt for fmt in exact if fmt.is_video_only]
    audio_only = [fmt for fmt in formats if fmt.is_audio_only]
    if not video_only or not audio_only:
        return None

    best_video = sorted(
        video_only,
        key=lambda item: (
            item.ext != "mp4",
            item.video_codec != "h264",
            -item.height,
            item.preference_rank,
        ),
    )[0]
    best_audio = sorted(
        audio_only,
        key=lambda item: (
            item.ext != "m4a",
            item.audio_codec != "aac",
            -(item.bitrate_kbps or 0),
            item.preference_rank,
        ),
    )[0]
    if best_video.ext == "mp4" and best_audio.ext in {"m4a", "mp4"}:
        container = "mp4"
    elif best_video.ext == "webm" and best_audio.ext in {"webm", "opus"}:
        container = "webm"
    else:
        container = "mkv"
    return FormatSelection(
        resolution=best_video.resolution,
        format_type="video",
        container_extension=container,
        video_format_id=best_video.format_id,
        audio_format_id=best_audio.format_id,
        merged=True,
        video_codec=best_video.video_codec,
        audio_codec=best_audio.audio_codec,
        audio_bitrate_kbps=best_audio.bitrate_kbps,
    )


def _select_audio_only(formats: list[FormatOption]) -> FormatSelection:
    audio_only = [fmt for fmt in formats if fmt.is_audio_only]
    if not audio_only:
        progressive = [fmt for fmt in formats if fmt.is_progressive]
        if not progressive:
            raise ValueError("No audio formats were found.")
        best = sorted(
            progressive,
            key=lambda item: (
                item.audio_codec == "none",
                item.ext != "mp4",
                -(item.bitrate_kbps or 0),
            ),
        )[0]
        return FormatSelection(
            resolution="audio",
            format_type="audio",
            container_extension="mp3",
            video_format_id=best.format_id,
            audio_format_id=None,
            merged=False,
            video_codec="none",
            audio_codec=best.audio_codec,
            audio_bitrate_kbps=best.bitrate_kbps,
        )

    best_audio = sorted(
        audio_only,
        key=lambda item: (
            item.ext not in {"m4a", "mp3"},
            item.audio_codec not in {"aac", "mp3"},
            -(item.bitrate_kbps or 0),
        ),
    )[0]
    return FormatSelection(
        resolution="audio",
        format_type="audio",
        container_extension="mp3",
        video_format_id=None,
        audio_format_id=best_audio.format_id,
        merged=False,
        video_codec="none",
        audio_codec=best_audio.audio_codec,
        audio_bitrate_kbps=best_audio.bitrate_kbps,
    )


def _resolution_candidates(
    preferred_resolution: str | None, formats: list[FormatOption]
) -> list[str]:
    available = list_resolutions(formats)
    priorities: list[str] = []
    if preferred_resolution and preferred_resolution != "auto":
        priorities.append(preferred_resolution)
    for default_resolution in DEFAULT_RESOLUTION_PRIORITY:
        if default_resolution not in priorities:
            priorities.append(default_resolution)
    for resolution in available:
        if resolution not in priorities:
            priorities.append(resolution)
    return priorities


def _resolution_label(raw: dict[str, Any], height: int) -> str:
    if height:
        return f"{height}p"
    return str(raw.get("resolution") or "unknown")


def _audio_bitrate(raw: dict[str, Any]) -> int | None:
    abr = raw.get("abr") or raw.get("tbr")
    if abr is None:
        return None
    try:
        return int(round(float(abr)))
    except (TypeError, ValueError):
        return None


def _normalize_codec(codec: Any) -> str:
    value = str(codec or "none")
    if value == "none":
        return value
    return value.split(".")[0]


def _preference_rank(ext: str, is_progressive: bool) -> int:
    if is_progressive and ext == "mp4":
        return 0
    if ext == "mp4":
        return 1
    if is_progressive:
        return 2
    return 3

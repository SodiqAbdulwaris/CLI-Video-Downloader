from __future__ import annotations

import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

import yt_dlp
from config.settings import COOKIES_FILE_PATH, DEFAULT_RETRY_ATTEMPTS, DEFAULT_TIMEOUT_SECONDS
from core.ffmpeg import FFmpegError, convert_to_mp3, merge_streams
from core.formats import FormatOption, FormatSelection, list_resolutions, normalize_formats, select_format
from core.playlist import PlaylistEntry, get_playlist_entries, is_playlist
from utils.file_utils import ensure_directory, ensure_unique_path, resolve_output_path, sanitize_name, temporary_prefix
from utils.logging_utils import log_download, log_error


class VideoDownloaderError(RuntimeError):
    pass


@dataclass(slots=True)
class DownloadContext:
    url: str
    title: str
    media_type: str
    playlist_title: str | None = None
    playlist_index: int | None = None


@dataclass(slots=True)
class PlaylistItemResult:
    index: int
    title: str
    filename: str | None
    status: Literal["completed", "failed"]
    duration: float | None
    error: str | None


@dataclass(slots=True)
class PlaylistResult:
    completed: int
    failed: int
    failures: list[str]
    item_results: list[PlaylistItemResult] = field(default_factory=list)


ProgressHook = Callable[[dict[str, Any]], None]
PlaylistItemStatusCallback = Callable[[PlaylistEntry, Literal["downloading", "done", "failed"], str | None], None]


class VideoDownloader:
    def __init__(self) -> None:
        self._base_options = {
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": DEFAULT_TIMEOUT_SECONDS,
            "http_headers": {},
        }
        print(f"Cookies file: {COOKIES_FILE_PATH.resolve()}")
        if COOKIES_FILE_PATH.exists():
            self._base_options["cookiefile"] = str(COOKIES_FILE_PATH)
        else:
            print(
                "Warning: cookie auth is not active because "
                f"{COOKIES_FILE_PATH} does not exist. YouTube bot-detection errors are more likely."
            )

    def fetch_info(self, url: str) -> dict[str, Any]:
        options = dict(self._base_options)
        options.update({"extract_flat": False, "skip_download": True, "noplaylist": False})
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                return ydl.extract_info(url, download=False)
        except yt_dlp.utils.DownloadError as exc:
            raise VideoDownloaderError(f"Could not fetch media information: {exc}") from exc

    def fetch_playlist_listing(self, url: str) -> dict[str, Any]:
        """Return playlist metadata and flat entry references without resolving every video."""
        options = dict(self._base_options)
        options.update({"extract_flat": "in_playlist", "skip_download": True, "noplaylist": False})
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                return ydl.extract_info(url, download=False)
        except yt_dlp.utils.DownloadError as exc:
            raise VideoDownloaderError(f"Could not fetch playlist information: {exc}") from exc

    def detect_type(self, info: dict[str, Any]) -> Literal["single", "playlist", "short"]:
        if is_playlist(info):
            return "playlist"
        webpage_url = str(info.get("webpage_url") or info.get("original_url") or "")
        if "/shorts/" in webpage_url:
            return "short"
        return "single"

    def get_formats(self, info: dict[str, Any]) -> list[FormatOption]:
        return normalize_formats(info)

    def list_available_resolutions(self, info: dict[str, Any]) -> list[str]:
        return list_resolutions(self.get_formats(info))

    def get_playlist_resolutions(self, entries: list[PlaylistEntry]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for entry in entries[:5]:
            try:
                info = self.fetch_info(entry.url)
            except VideoDownloaderError:
                continue
            for resolution in self.list_available_resolutions(info):
                if resolution not in seen:
                    seen.add(resolution)
                    ordered.append(resolution)
        return ordered

    def select_best_format(
        self,
        formats: list[FormatOption],
        preferred_res: str = "720p",
        format_type: str = "video",
    ) -> FormatSelection:
        try:
            return select_format(formats, preferred_res, format_type)
        except ValueError as exc:
            raise VideoDownloaderError(str(exc)) from exc

    def generate_filename(
        self,
        title: str,
        selection: FormatSelection,
        extension: str,
        playlist_index: int | None = None,
    ) -> str:
        safe_title = sanitize_name(title)
        if selection.format_type == "audio":
            bitrate = (
                f"{selection.audio_bitrate_kbps}kbps" if selection.audio_bitrate_kbps else "unknown"
            )
            base_name = f"{safe_title}_audio"
        else:
            base_name = f"{safe_title}_{selection.resolution}_{selection.video_codec}"
        if playlist_index is not None:
            base_name = f"{playlist_index:02d}_{base_name}"
        return f"{base_name}.{extension}"

    def download(
        self,
        url: str,
        selection: FormatSelection | None,
        download_path: Path | None,
        media_type: str,
        preferred_resolution: str | None = None,
        format_type: str = "video",
        playlist_index: int | None = None,
        playlist_title: str | None = None,
        progress_hook: ProgressHook | None = None,
    ) -> Path:
        info = self.fetch_info(url)
        formats = self.get_formats(info)
        selected = selection or self.select_best_format(
            formats=formats,
            preferred_res=preferred_resolution or "720p",
            format_type=format_type,
        )
        target_dir = download_path or resolve_output_path(media_type=media_type, playlist_title=playlist_title)
        ensure_directory(target_dir)

        context = DownloadContext(
            url=url,
            title=str(info.get("title") or "video"),
            media_type=media_type,
            playlist_title=playlist_title,
            playlist_index=playlist_index,
        )

        for attempt in range(1, DEFAULT_RETRY_ATTEMPTS + 1):
            try:
                return self._download_once(
                    info=info,
                    selection=selected,
                    target_dir=target_dir,
                    context=context,
                    progress_hook=progress_hook,
                )
            except (yt_dlp.utils.DownloadError, OSError, FFmpegError, VideoDownloaderError) as exc:
                if attempt == DEFAULT_RETRY_ATTEMPTS:
                    filename = self.generate_filename(
                        title=context.title,
                        selection=selected,
                        extension=selected.container_extension,
                        playlist_index=playlist_index,
                    )
                    log_error(
                        url=url,
                        media_type=media_type.title(),
                        resolution=selected.resolution,
                        format_type="audio-only" if format_type == "audio" else "video+audio",
                        codec=selected.codec_label,
                        download_path=str(target_dir),
                        filename=filename,
                        error_message=str(exc),
                    )
                    raise VideoDownloaderError(str(exc)) from exc
        raise VideoDownloaderError("Download failed unexpectedly.")

    def download_playlist(
        self,
        url: str,
        indices: list[int],
        resolution: str | None,
        format_type: str,
        playlist_info: dict[str, Any] | None = None,
        progress_hook_factory: Callable[[PlaylistEntry], ProgressHook | None] | None = None,
        item_status_callback: PlaylistItemStatusCallback | None = None,
    ) -> PlaylistResult:
        info = playlist_info or self.fetch_playlist_listing(url)
        entries = get_playlist_entries(info)
        playlist_title = str(info.get("title") or "Playlist")
        failures: list[str] = []
        completed = 0

        item_results: list[PlaylistItemResult] = []

        for offset, index in enumerate(indices, start=1):
            entry = entries[index]
            print(f"Downloading video {offset} of {len(indices)}: {entry.title}")
            try:
                if item_status_callback:
                    item_status_callback(entry, "downloading", None)
                entry_info = self.fetch_info(entry.url)
                selected = self.select_best_format(
                    formats=self.get_formats(entry_info),
                    preferred_res=resolution or "720p",
                    format_type=format_type,
                )
                final_path = self.download(
                    url=entry.url,
                    selection=selected,
                    download_path=resolve_output_path(media_type="playlist", playlist_title=playlist_title),
                    media_type="playlist",
                    preferred_resolution=resolution,
                    format_type=format_type,
                    playlist_index=entry.index,
                    playlist_title=playlist_title,
                    progress_hook=progress_hook_factory(entry) if progress_hook_factory else None,
                )
                completed += 1
                if item_status_callback:
                    item_status_callback(entry, "done", None)
                item_results.append(
                    PlaylistItemResult(
                        index=entry.index,
                        title=entry.title,
                        filename=final_path.name,
                        status="completed",
                        duration=entry.duration,
                        error=None,
                    )
                )
            except Exception as exc:
                failures.append(f"{entry.index}. {entry.title}: {exc}")
                if item_status_callback:
                    item_status_callback(entry, "failed", str(exc))
                item_results.append(
                    PlaylistItemResult(
                        index=entry.index,
                        title=entry.title,
                        filename=None,
                        status="failed",
                        duration=entry.duration,
                        error=str(exc),
                    )
                )
                log_error(
                    url=entry.url,
                    media_type="Playlist",
                    resolution=resolution or "auto",
                    format_type="audio-only" if format_type == "audio" else "video+audio",
                    codec="unknown",
                    download_path=str(resolve_output_path("playlist", playlist_title)),
                    filename=entry.title,
                    error_message=str(exc),
                )

        return PlaylistResult(completed=completed, failed=len(failures), failures=failures, item_results=item_results)

    def _download_once(
        self,
        info: dict[str, Any],
        selection: FormatSelection,
        target_dir: Path,
        context: DownloadContext,
        progress_hook: ProgressHook | None = None,
    ) -> Path:
        title = str(info.get("title") or "video")
        with tempfile.TemporaryDirectory(prefix="yt_downloader_") as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            if selection.format_type == "audio":
                input_path = self._download_stream(
                    url=context.url,
                    format_selector=selection.audio_format_id or selection.video_format_id,
                    output_prefix=temporary_prefix(temp_dir, "audio_source"),
                    title=title,
                    progress_hook=progress_hook,
                )
                final_name = self.generate_filename(
                    title=title,
                    selection=selection,
                    extension="mp3",
                    playlist_index=context.playlist_index,
                )
                final_path = ensure_unique_path(target_dir / final_name)
                convert_to_mp3(input_path, final_path)
                self._log_success(final_path=final_path, selection=selection, context=context)
                return final_path

            final_name = self.generate_filename(
                title=title,
                selection=selection,
                extension=selection.container_extension,
                playlist_index=context.playlist_index,
            )
            final_path = ensure_unique_path(target_dir / final_name)

            if selection.merged:
                video_path = self._download_stream(
                    url=context.url,
                    format_selector=selection.video_format_id,
                    output_prefix=temporary_prefix(temp_dir, "video_stream"),
                    title=title,
                    progress_hook=progress_hook,
                )
                audio_path = self._download_stream(
                    url=context.url,
                    format_selector=selection.audio_format_id,
                    output_prefix=temporary_prefix(temp_dir, "audio_stream"),
                    title=title,
                    progress_hook=progress_hook,
                )
                merge_streams(video_path, audio_path, final_path)
                self._log_success(final_path=final_path, selection=selection, context=context)
                return final_path

            downloaded = self._download_stream(
                url=context.url,
                format_selector=selection.video_format_id,
                output_prefix=temporary_prefix(temp_dir, "muxed_stream"),
                title=title,
                progress_hook=progress_hook,
            )
            downloaded.replace(final_path)
            self._log_success(final_path=final_path, selection=selection, context=context)
            return final_path

    def _log_success(
        self,
        *,
        final_path: Path,
        selection: FormatSelection,
        context: DownloadContext,
    ) -> None:
        log_download(
            url=context.url,
            media_type=context.media_type.title(),
            resolution=selection.resolution,
            format_type="audio-only" if selection.format_type == "audio" else "video+audio",
            codec=selection.codec_label,
            download_path=str(final_path.parent),
            filename=final_path.name,
        )

    def _download_stream(
        self,
        url: str,
        format_selector: str | None,
        output_prefix: Path,
        title: str,
        progress_hook: ProgressHook | None = None,
    ) -> Path:
        if not format_selector:
            raise VideoDownloaderError("A required media stream could not be identified.")

        before = set(output_prefix.parent.iterdir())
        options = dict(self._base_options)
        options.update(
            {
                "format": format_selector,
                "outtmpl": str(output_prefix) + ".%(ext)s",
                "quiet": False,
                "noprogress": False,
                "noplaylist": True,
            }
        )
        if progress_hook:
            options["progress_hooks"] = [progress_hook]
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([url])

        created = [
            path
            for path in output_prefix.parent.iterdir()
            if path not in before and path.is_file() and path.name.startswith(output_prefix.name)
        ]
        if not created:
            created = [item for item in output_prefix.parent.glob(f"{output_prefix.name}.*") if item.is_file()]
        if not created:
            raise VideoDownloaderError("Download finished but no output file was produced.")
        return sorted(created, key=lambda item: item.stat().st_mtime, reverse=True)[0]

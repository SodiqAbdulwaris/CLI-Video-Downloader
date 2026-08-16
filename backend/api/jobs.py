from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from api.thumbnail import extract_thumbnail
from core.downloader import VideoDownloader
from core.playlist import PlaylistEntry, get_playlist_entries
from services.history_service import history_service
from services.settings_service import settings_service

logger = logging.getLogger(__name__)

JobStatus = Literal["queued", "running", "completed", "partial", "failed"]
ItemState = Literal["queued", "downloading", "done", "failed"]


@dataclass(slots=True)
class JobItem:
    index: int | None
    title: str
    state: ItemState = "queued"
    error: str | None = None


@dataclass(slots=True)
class DownloadJob:
    id: str
    url: str
    format_type: str
    resolution: str | None
    requested_indices: list[int] | None
    events: asyncio.Queue[dict[str, Any]]
    loop: asyncio.AbstractEventLoop
    status: JobStatus = "queued"
    items: list[JobItem] = field(default_factory=list)
    last_job_event: dict[str, Any] | None = None


class JobManager:
    """Keeps in-memory download jobs and bridges blocking callbacks to asyncio queues."""

    def __init__(self) -> None:
        self._jobs: dict[str, DownloadJob] = {}

    def create_job(
        self,
        *,
        url: str,
        format_type: str,
        resolution: str | None,
        indices: list[int] | None,
    ) -> DownloadJob:
        loop = asyncio.get_running_loop()
        job = DownloadJob(
            id=str(uuid4()),
            url=url,
            format_type=format_type,
            resolution=resolution,
            requested_indices=indices,
            events=asyncio.Queue(),
            loop=loop,
        )
        self._jobs[job.id] = job
        self._emit(job, {"type": "job", "status": "queued", "job_id": job.id})
        asyncio.create_task(asyncio.to_thread(self._run_download, job))
        return job

    def get_job(self, job_id: str) -> DownloadJob | None:
        return self._jobs.get(job_id)

    def _emit(self, job: DownloadJob, event: dict[str, Any]) -> None:
        if event.get("type") == "job":
            # Remembered so a client that (re)connects after the job already
            # reached a terminal state gets the full event (including any
            # error/failure detail), not just a bare status string.
            job.last_job_event = event
        job.loop.call_soon_threadsafe(job.events.put_nowait, event)

    def _set_item_state(
        self,
        job: DownloadJob,
        entry: PlaylistEntry,
        state: ItemState,
        error: str | None = None,
    ) -> None:
        item = next((item for item in job.items if item.index == entry.index), None)
        if not item:
            return
        item.state = state
        item.error = error
        self._emit(
            job,
            {
                "type": "item",
                "item": item.title,
                "index": item.index,
                "status": state,
                "error": error,
            },
        )

    def _progress_hook(self, job: DownloadJob, entry: PlaylistEntry | None, title: str):
        def hook(update: dict[str, Any]) -> None:
            if update.get("status") != "downloading":
                return
            percent = _progress_percent(update)
            self._emit(
                job,
                {
                    "type": "progress",
                    "item": title,
                    "index": entry.index if entry else None,
                    "status": "downloading",
                    "percent": percent,
                },
            )

        return hook

    def _run_download(self, job: DownloadJob) -> None:
        job.status = "running"
        self._emit(job, {"type": "job", "status": "running", "job_id": job.id})
        start_time = datetime.now(timezone.utc).isoformat()

        title = "Download"
        thumbnail = None
        media_type = "video"
        files_list: list[dict[str, Any]] = []
        completed_count = 0
        failed_count = 0

        try:
            downloader = VideoDownloader()
            listing_info = downloader.fetch_playlist_listing(job.url)
            media_type = downloader.detect_type(listing_info)

            if media_type == "playlist":
                title = str(listing_info.get("title") or "Playlist")
                thumbnail = extract_thumbnail(listing_info)
                entries = get_playlist_entries(listing_info)
                positions = _select_positions(entries, job.requested_indices)
                selected_entries = [entries[position] for position in positions]
                job.items = [JobItem(index=entry.index, title=entry.title) for entry in selected_entries]
                for item in job.items:
                    self._emit(job, {"type": "item", **asdict(item)})

                result = downloader.download_playlist(
                    url=job.url,
                    indices=positions,
                    resolution=job.resolution,
                    format_type=job.format_type,
                    playlist_info=listing_info,
                    progress_hook_factory=lambda entry: self._progress_hook(job, entry, entry.title),
                    item_status_callback=lambda entry, state, error: self._set_item_state(
                        job, entry, state, error
                    ),
                )
                completed_count = result.completed
                failed_count = result.failed
                files_list = [
                    {
                        "title": item.title,
                        "filename": item.filename,
                        "status": item.status,
                        "duration": item.duration,
                        "resolution": job.resolution,
                        "error": item.error,
                    }
                    for item in result.item_results
                ]

                if result.failed:
                    job.status = "partial" if result.completed else "failed"
                    self._save_history(
                        job=job,
                        start_time=start_time,
                        title=title,
                        media_type=media_type,
                        thumbnail=thumbnail,
                        files_list=files_list,
                        completed_count=completed_count,
                        failed_count=failed_count,
                    )
                    self._emit(
                        job,
                        {
                            "type": "job",
                            "status": job.status,
                            "job_id": job.id,
                            "completed": result.completed,
                            "failed": result.failed,
                            "failures": result.failures,
                        },
                    )
                    return
            else:
                info = downloader.fetch_info(job.url)
                title = str(info.get("title") or "video")
                thumbnail = extract_thumbnail(info)
                duration = info.get("duration")
                job.items = [JobItem(index=None, title=title)]
                self._emit(job, {"type": "item", **asdict(job.items[0])})
                job.items[0].state = "downloading"
                self._emit(job, {"type": "item", **asdict(job.items[0])})
                final_path = downloader.download(
                    url=job.url,
                    selection=None,
                    download_path=None,
                    media_type=media_type,
                    preferred_resolution=job.resolution,
                    format_type=job.format_type,
                    progress_hook=self._progress_hook(job, None, title),
                )
                job.items[0].state = "done"
                self._emit(job, {"type": "item", **asdict(job.items[0])})

                completed_count = 1
                failed_count = 0
                files_list = [
                    {
                        "title": title,
                        "filename": final_path.name,
                        "status": "completed",
                        "duration": duration,
                        "resolution": job.resolution,
                        "error": None,
                    }
                ]

            job.status = "completed"
            self._save_history(
                job=job,
                start_time=start_time,
                title=title,
                media_type=media_type,
                thumbnail=thumbnail,
                files_list=files_list,
                completed_count=completed_count,
                failed_count=failed_count,
            )
            self._emit(job, {"type": "job", "status": "completed", "job_id": job.id})
        except Exception as exc:
            job.status = "failed"
            completed_count = 0
            failed_count = len(job.items) if job.items else 1
            if not files_list:
                files_list = [
                    {
                        "title": item.title if hasattr(item, "title") else title,
                        "filename": None,
                        "status": "failed",
                        "duration": None,
                        "resolution": job.resolution,
                        "error": str(exc),
                    }
                    for item in (job.items if job.items else [JobItem(index=None, title=title)])
                ]
            self._save_history(
                job=job,
                start_time=start_time,
                title=title,
                media_type=media_type,
                thumbnail=thumbnail,
                files_list=files_list,
                completed_count=completed_count,
                failed_count=failed_count,
            )
            self._emit(
                job,
                {"type": "job", "status": "failed", "job_id": job.id, "error": str(exc)},
            )

    def _save_history(
        self,
        *,
        job: DownloadJob,
        start_time: str,
        title: str,
        media_type: str,
        thumbnail: str | None,
        files_list: list[dict[str, Any]],
        completed_count: int,
        failed_count: int,
    ) -> None:
        try:
            if completed_count > 0 and failed_count == 0:
                status = "completed"
            elif completed_count > 0 and failed_count > 0:
                status = "partial"
            else:
                status = "failed"

            completed_at = datetime.now(timezone.utc).isoformat()
            session = {
                "id": job.id,
                "createdAt": start_time,
                "completedAt": completed_at,
                "sourceUrl": job.url,
                "title": title,
                "type": media_type,
                "format": job.format_type,
                "resolution": job.resolution,
                "requestedIndices": job.requested_indices,
                "status": status,
                "total": completed_count + failed_count,
                "successful": completed_count,
                "failed": failed_count,
                "downloadLocation": settings_service.get_download_directory() or "Downloads/",
                "thumbnail": thumbnail,
                "files": files_list,
            }
            history_service.add_history_session(session)
        except Exception as exc:
            logger.error("Failed to persist download history: %s", exc)


def _select_positions(entries: list[PlaylistEntry], requested_indices: list[int] | None) -> list[int]:
    if requested_indices is None:
        return list(range(len(entries)))

    positions_by_index = {entry.index: position for position, entry in enumerate(entries)}
    missing = [index for index in requested_indices if index not in positions_by_index]
    if missing:
        raise ValueError(f"Playlist indices not found: {', '.join(map(str, missing))}")
    return [positions_by_index[index] for index in requested_indices]


def _progress_percent(update: dict[str, Any]) -> int | None:
    downloaded = update.get("downloaded_bytes")
    total = update.get("total_bytes") or update.get("total_bytes_estimate")
    if isinstance(downloaded, (int, float)) and isinstance(total, (int, float)) and total > 0:
        return max(0, min(100, round(downloaded / total * 100)))

    raw_percent = update.get("_percent_str")
    if raw_percent is None:
        return None
    match = re.search(r"\d+(?:\.\d+)?", re.sub(r"\x1b\[[0-9;]*m", "", str(raw_percent)))
    if not match:
        return None
    return max(0, min(100, round(float(match.group()))))

from __future__ import annotations

import asyncio
import logging
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import yt_dlp

from api.thumbnail import extract_thumbnail
from download_engine.downloader import VideoDownloader
from download_engine.file_utils import ensure_directory, sanitize_name
from download_engine.logging_utils import log_error
from download_engine.playlist import PlaylistEntry, get_playlist_entries
from services.history_service import history_service
from services.settings_service import settings_service

logger = logging.getLogger(__name__)

JobStatus = Literal["queued", "running", "paused", "completed", "partial", "failed"]
TaskState = Literal["queued", "downloading", "paused", "done", "failed", "cancelled"]

_ACTIVE_STATES = {"queued", "downloading"}
_TERMINAL_STATES = {"done", "failed", "cancelled"}


@dataclass(slots=True)
class DownloadTask:
    id: str
    job_id: str
    url: str
    title: str
    index: int | None  # playlist position (matches PlaylistEntry.index), or None for a single video
    state: TaskState = "queued"
    error: str | None = None
    filename: str | None = None
    duration: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    pause_event: threading.Event = field(default_factory=threading.Event)


@dataclass(slots=True)
class DownloadJob:
    id: str
    url: str
    format_type: str
    resolution: str | None
    requested_indices: list[int] | None
    events: "asyncio.Queue[dict[str, Any]]"
    loop: asyncio.AbstractEventLoop
    status: JobStatus = "queued"
    task_ids: list[str] = field(default_factory=list)
    title: str = "Download"
    media_type: str = "video"
    thumbnail: str | None = None
    download_path: Any = None
    start_time: str = ""
    last_job_event: dict[str, Any] | None = None
    finalized: bool = False


class ConcurrencyGate:
    """Limits how many downloads run at once, with a limit that can change at
    runtime (an asyncio.Semaphore's value is fixed at creation, which doesn't
    fit a user-editable Settings value)."""

    def __init__(self, limit: int) -> None:
        self._limit = max(1, limit)
        self._active = 0
        self._condition: asyncio.Condition | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _condition_for_current_loop(self) -> asyncio.Condition:
        # asyncio.Condition binds to whichever loop is running the first time
        # it's awaited. JobManager (and this gate) is a module-level
        # singleton constructed once, which is fine for a real server (one
        # loop for the process's whole lifetime) but not for tests that spin
        # up a fresh loop per TestClient — recreate it if the loop changed.
        loop = asyncio.get_running_loop()
        if self._loop is not loop:
            self._loop = loop
            self._condition = asyncio.Condition()
        return self._condition

    async def acquire(self) -> None:
        condition = self._condition_for_current_loop()
        async with condition:
            while self._active >= self._limit:
                await condition.wait()
            self._active += 1

    async def release(self) -> None:
        condition = self._condition_for_current_loop()
        async with condition:
            self._active = max(0, self._active - 1)
            condition.notify_all()

    async def set_limit(self, limit: int) -> None:
        condition = self._condition_for_current_loop()
        async with condition:
            self._limit = max(1, limit)
            condition.notify_all()


class TaskNotFoundError(LookupError):
    pass


class JobManager:
    """Keeps in-memory download jobs/tasks and bridges blocking callbacks to
    asyncio queues. Each video (standalone or a playlist entry) is its own
    DownloadTask, scheduled independently through a shared ConcurrencyGate —
    this is what makes both "multiple videos from one playlist at once" and
    "multiple jobs at once" work through a single mechanism."""

    def __init__(self) -> None:
        self._jobs: dict[str, DownloadJob] = {}
        self._tasks: dict[str, DownloadTask] = {}
        self._gate = ConcurrencyGate(settings_service.get_max_concurrent_downloads())

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
        self._emit_job(job, {"type": "job", "status": "queued", "job_id": job.id})
        asyncio.create_task(asyncio.to_thread(self._resolve_and_schedule, job))
        return job

    def get_job(self, job_id: str) -> DownloadJob | None:
        return self._jobs.get(job_id)

    def get_task(self, task_id: str) -> DownloadTask | None:
        return self._tasks.get(task_id)

    # ---- pause / resume / cancel -------------------------------------------------

    def pause_task(self, task_id: str) -> DownloadTask:
        task = self._require_task(task_id)
        if task.state == "downloading":
            task.pause_event.set()
        elif task.state == "queued":
            # Never started running yet — nothing to interrupt, just mark it.
            task.state = "paused"
            job = self._jobs.get(task.job_id)
            if job:
                self._emit_task(job, task)
                self._update_job_status(job)
        return task

    def resume_task(self, task_id: str) -> DownloadTask:
        task = self._require_task(task_id)
        if task.state != "paused":
            return task
        job = self._jobs[task.job_id]
        task.pause_event = threading.Event()
        task.cancel_event = threading.Event()
        task.state = "queued"
        task.error = None
        self._emit_task(job, task)
        self._update_job_status(job)
        asyncio.create_task(self._run_task(task, job))
        return task

    def cancel_task(self, task_id: str) -> DownloadTask:
        task = self._require_task(task_id)
        if task.state in _TERMINAL_STATES:
            return task
        job = self._jobs.get(task.job_id)
        if task.state in ("queued", "paused"):
            task.state = "cancelled"
            if job:
                self._emit_task(job, task)
                if not self._maybe_finalize_job(job):
                    self._update_job_status(job)
        else:
            task.cancel_event.set()
        return task

    def cancel_job(self, job_id: str) -> DownloadJob:
        job = self._require_job(job_id)
        for task_id in job.task_ids:
            self.cancel_task(task_id)
        return job

    def _require_job(self, job_id: str) -> DownloadJob:
        job = self._jobs.get(job_id)
        if job is None:
            raise TaskNotFoundError(f"Unknown job: {job_id}")
        return job

    def _require_task(self, task_id: str) -> DownloadTask:
        task = self._tasks.get(task_id)
        if task is None:
            raise TaskNotFoundError(f"Unknown task: {task_id}")
        return task

    # ---- event plumbing ------------------------------------------------------

    def _emit_job(self, job: DownloadJob, event: dict[str, Any]) -> None:
        job.last_job_event = event
        job.loop.call_soon_threadsafe(job.events.put_nowait, event)

    def _emit_task(self, job: DownloadJob, task: DownloadTask) -> None:
        job.loop.call_soon_threadsafe(
            job.events.put_nowait,
            {
                "type": "item",
                "task_id": task.id,
                "index": task.index,
                "title": task.title,
                "status": task.state,
                "error": task.error,
            },
        )

    # ---- resolving a URL into tasks, then running them ------------------------

    def _resolve_and_schedule(self, job: DownloadJob) -> None:
        """Runs in a worker thread: resolve the URL into one task per video,
        then hand each to the scheduler. Kept separate from actually
        downloading so tasks can be scheduled independently once known."""
        try:
            job.download_path = ensure_directory(settings_service.require_target_download_dir())
            downloader = VideoDownloader()
            listing_info = downloader.fetch_playlist_listing(job.url)
            job.media_type = downloader.detect_type(listing_info)
            job.start_time = datetime.now(timezone.utc).isoformat()

            entries: list[PlaylistEntry | None]
            if job.media_type == "playlist":
                job.title = str(listing_info.get("title") or "Playlist")
                job.thumbnail = extract_thumbnail(listing_info)
                all_entries = get_playlist_entries(listing_info)
                positions = _select_positions(all_entries, job.requested_indices)
                entries = [all_entries[position] for position in positions]
            else:
                info = downloader.fetch_info(job.url)
                job.title = str(info.get("title") or "video")
                job.thumbnail = extract_thumbnail(info)
                entries = [None]

            tasks = []
            for entry in entries:
                task = DownloadTask(
                    id=str(uuid4()),
                    job_id=job.id,
                    url=entry.url if entry else job.url,
                    title=entry.title if entry else job.title,
                    index=entry.index if entry else None,
                )
                self._tasks[task.id] = task
                job.task_ids.append(task.id)
                tasks.append(task)

            job.status = "running"
            self._emit_job(job, {"type": "job", "status": "running", "job_id": job.id})
            for task in tasks:
                self._emit_task(job, task)
            for task in tasks:
                job.loop.call_soon_threadsafe(
                    lambda t=task: asyncio.create_task(self._run_task(t, job))
                )
        except Exception as exc:
            job.status = "failed"
            self._save_history(job, files_list=[{
                "title": job.title, "filename": None, "status": "failed",
                "duration": None, "resolution": job.resolution, "error": str(exc),
            }])
            self._emit_job(job, {"type": "job", "status": "failed", "job_id": job.id, "error": str(exc)})

    async def _run_task(self, task: DownloadTask, job: DownloadJob) -> None:
        if task.state != "cancelled":
            await self._gate.set_limit(settings_service.get_max_concurrent_downloads())
            await self._gate.acquire()
            try:
                # Re-check: this task may have been cancelled while it sat
                # here waiting for a slot — don't start a download that
                # nothing will ever release.
                if task.state != "cancelled":
                    task.state = "downloading"
                    self._emit_task(job, task)
                    await asyncio.to_thread(self._run_task_blocking, task, job)
            finally:
                await self._gate.release()
        self._emit_task(job, task)
        if not self._maybe_finalize_job(job):
            self._update_job_status(job)

    def _run_task_blocking(self, task: DownloadTask, job: DownloadJob) -> None:
        downloader = VideoDownloader()
        try:
            entry_info = downloader.fetch_info(task.url)
            formats = downloader.get_formats(entry_info)
            selected = downloader.select_best_format(
                formats=formats,
                preferred_res=job.resolution or "720p",
                format_type=job.format_type,
            )
            final_path = downloader.download(
                url=task.url,
                selection=selected,
                download_path=job.download_path,
                media_type=job.media_type,
                preferred_resolution=job.resolution,
                format_type=job.format_type,
                playlist_index=task.index,
                playlist_title=job.title if job.media_type == "playlist" else None,
                progress_hook=self._progress_hook(job, task, selected.merged),
            )
            task.state = "done"
            task.filename = final_path.name
            task.error = None
        except yt_dlp.utils.DownloadCancelled:
            task.state = "cancelled" if task.cancel_event.is_set() else "paused"
            task.error = None
        except Exception as exc:
            task.state = "failed"
            task.error = str(exc)
            if not getattr(exc, "logged", False):
                log_error(
                    url=task.url,
                    media_type=(job.media_type or "video").title(),
                    resolution=job.resolution or "auto",
                    format_type="audio-only" if job.format_type == "audio" else "video+audio",
                    codec="unknown",
                    download_path=str(job.download_path),
                    filename=task.title,
                    error_message=str(exc),
                )

    def _progress_hook(self, job: DownloadJob, task: DownloadTask, merged: bool):
        def hook(update: dict[str, Any]) -> None:
            if task.cancel_event.is_set() or task.pause_event.is_set():
                raise yt_dlp.utils.DownloadCancelled("Cancelled")
            if update.get("status") != "downloading":
                return
            raw_percent = _progress_percent(update)
            stage = _stage_from_filename(str(update.get("filename") or update.get("tmpfilename") or ""))
            percent = _weighted_percent(raw_percent, stage, merged)
            self._emit_job(
                job,
                {
                    "type": "progress",
                    "task_id": task.id,
                    "item": task.title,
                    "index": task.index,
                    "status": "downloading",
                    "percent": percent,
                },
            )

        return hook

    # ---- status aggregation ----------------------------------------------------

    def _job_tasks(self, job: DownloadJob) -> list[DownloadTask]:
        return [self._tasks[tid] for tid in job.task_ids if tid in self._tasks]

    def _update_job_status(self, job: DownloadJob) -> None:
        tasks = self._job_tasks(job)
        if not tasks:
            return
        status = _derive_job_status(tasks)
        if status != job.status:
            job.status = status
            self._emit_job(job, {"type": "job", "status": status, "job_id": job.id})

    def _maybe_finalize_job(self, job: DownloadJob) -> bool:
        """Emits the job's terminal status (with completed/failed counts) and
        saves history if every task has reached a terminal state. Returns
        whether it did, so callers know not to also emit a plain status
        change for the same transition."""
        if job.finalized:
            return False
        tasks = self._job_tasks(job)
        if not tasks or not all(t.state in _TERMINAL_STATES for t in tasks):
            return False
        job.finalized = True
        completed_count = sum(1 for t in tasks if t.state == "done")
        failed_count = sum(1 for t in tasks if t.state in ("failed", "cancelled"))
        files_list = [
            {
                "title": t.title,
                "filename": t.filename,
                "status": "completed" if t.state == "done" else t.state,
                "duration": t.duration,
                "resolution": job.resolution,
                "error": t.error,
            }
            for t in tasks
        ]
        if completed_count > 0 and failed_count == 0:
            job.status = "completed"
        elif completed_count > 0:
            job.status = "partial"
        else:
            job.status = "failed"
        self._save_history(job, files_list=files_list, completed_count=completed_count, failed_count=failed_count)
        self._emit_job(job, {
            "type": "job", "status": job.status, "job_id": job.id,
            "completed": completed_count, "failed": failed_count,
        })
        return True

    def _save_history(
        self,
        job: DownloadJob,
        *,
        files_list: list[dict[str, Any]],
        completed_count: int = 0,
        failed_count: int = 0,
    ) -> None:
        try:
            completed_at = datetime.now(timezone.utc).isoformat()
            base_location = settings_service.get_download_directory() or "Downloads/"
            # Playlist items land in a subfolder named after the playlist
            # (see download_engine.downloader.download) — reflect that here
            # so history points at where the files actually are.
            download_location = (
                str(Path(base_location) / sanitize_name(job.title))
                if job.media_type == "playlist"
                else base_location
            )
            session = {
                "id": job.id,
                "createdAt": job.start_time or completed_at,
                "completedAt": completed_at,
                "sourceUrl": job.url,
                "title": job.title,
                "type": job.media_type,
                "format": job.format_type,
                "resolution": job.resolution,
                "requestedIndices": job.requested_indices,
                "status": job.status,
                "total": completed_count + failed_count,
                "successful": completed_count,
                "failed": failed_count,
                "downloadLocation": download_location,
                "thumbnail": job.thumbnail,
                "files": files_list,
            }
            history_service.add_history_session(session)
        except Exception as exc:
            logger.error("Failed to persist download history: %s", exc)


def _derive_job_status(tasks: list[DownloadTask]) -> JobStatus:
    if any(t.state == "downloading" for t in tasks):
        return "running"
    if any(t.state == "queued" for t in tasks):
        return "running"
    if any(t.state == "paused" for t in tasks):
        return "paused"
    completed_count = sum(1 for t in tasks if t.state == "done")
    failed_count = sum(1 for t in tasks if t.state in ("failed", "cancelled"))
    if completed_count > 0 and failed_count == 0:
        return "completed"
    if completed_count > 0:
        return "partial"
    return "failed"


def _select_positions(entries: list[PlaylistEntry], requested_indices: list[int] | None) -> list[int]:
    if requested_indices is None:
        return list(range(len(entries)))

    positions_by_index = {entry.index: position for position, entry in enumerate(entries)}
    missing = [index for index in requested_indices if index not in positions_by_index]
    if missing:
        raise ValueError(f"Playlist indices not found: {', '.join(map(str, missing))}")
    return [positions_by_index[index] for index in requested_indices]


def _stage_from_filename(filename: str) -> str | None:
    if "video_stream" in filename:
        return "video"
    if "audio_stream" in filename:
        return "audio"
    return None


def _weighted_percent(raw_percent: int | None, stage: str | None, merged: bool) -> int | None:
    """A merged download runs two full 0-100% streams back to back (video,
    then audio) reusing the same hook — without this, the reported percent
    visibly resets from ~100% to ~0% when the audio stream starts. Video is
    almost always the larger stream, so a fixed 0-85/85-100 split is a good
    approximation without tracking byte totals across both streams."""
    if raw_percent is None or not merged or stage is None:
        return raw_percent
    if stage == "video":
        return round(raw_percent * 0.85)
    return round(85 + raw_percent * 0.15)


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

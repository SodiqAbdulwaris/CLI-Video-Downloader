from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path

from api.history import router as history_router
from api.jobs import JobManager
from api.settings import router as settings_router
from api.thumbnail import extract_thumbnail
from config.settings import CORS_ALLOWED_ORIGINS
from download_engine.config import COOKIES_FILE_PATH
from download_engine.downloader import VideoDownloader, VideoDownloaderError
from download_engine.file_utils import ensure_directory
from download_engine.playlist import get_playlist_entries
from download_engine.validators import is_valid_url
from services.settings_service import settings_service

MAX_COOKIES_FILE_SIZE = 1 * 1024 * 1024  # cookies.txt files are a few KB at most

app = FastAPI(title="YT-Video Downloader API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(history_router)
app.include_router(settings_router)
jobs = JobManager()


@app.get("/health")
async def health_check() -> dict:
    """Lightweight liveness probe used by Docker Compose healthcheck."""
    return {"status": "ok"}


class ResolveRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_type: Literal["video", "audio"]
    resolution: str | None = None
    indices: list[int] | None = Field(
        default=None,
        description="Playlist entry indices as returned by /api/resolve; omit for every entry.",
    )


@app.post("/api/resolve")
async def resolve(request: ResolveRequest) -> dict:
    if not is_valid_url(request.url):
        raise HTTPException(status_code=422, detail="Provide a valid http or https URL.")
    try:
        return await asyncio.to_thread(_resolve, request.url)
    except VideoDownloaderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/download")
async def download(request: DownloadRequest) -> dict[str, str]:
    if not is_valid_url(request.url):
        raise HTTPException(status_code=422, detail="Provide a valid http or https URL.")
    if settings_service.get_download_directory() is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "A download location has not been configured yet. Open Settings and "
                "choose where downloads should be saved before starting a download."
            ),
        )
    job = jobs.create_job(
        url=request.url,
        format_type=request.format_type,
        resolution=request.resolution,
        indices=request.indices,
    )
    return {"job_id": job.id}

 

@app.post("/api/cookies")
async def upload_cookies(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Expected a .txt cookies file (Netscape format).")

    # Read one byte past the cap instead of the whole body, so an oversized
    # upload can't buffer arbitrarily large content in memory before rejection.
    content = await file.read(MAX_COOKIES_FILE_SIZE + 1)
    if len(content) > MAX_COOKIES_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Cookies file is too large (max 1 MiB).")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded cookies file is empty.")

    cookies_path = COOKIES_FILE_PATH
    ensure_directory(cookies_path.parent)

    tmp_path = cookies_path.with_suffix(".txt.tmp")
    tmp_path.write_bytes(content)
    tmp_path.replace(cookies_path)

    return {
        "success": True,
        "filename": file.filename,
    }

@app.websocket("/api/ws/{job_id}")
async def job_events(websocket: WebSocket, job_id: str) -> None:
    job = jobs.get_job(job_id)
    if not job:
        await websocket.close(code=4404, reason="Unknown job ID")
        return

    await websocket.accept()
    terminal_statuses = {"completed", "partial", "failed"}
    try:
        if job.status in terminal_statuses:
            # A reconnect (or a client that connects after the job already
            # finished) would otherwise block forever: the terminal event was
            # already consumed from the queue by an earlier connection and
            # nothing new will ever be emitted.
            snapshot = job.last_job_event or {"type": "job", "status": job.status, "job_id": job.id}
            await websocket.send_json(snapshot)
            return
        while True:
            event = await job.events.get()
            await websocket.send_json(event)
            if event.get("type") == "job" and event.get("status") in terminal_statuses:
                break
    except WebSocketDisconnect:
        return




def _resolve(url: str) -> dict:
    downloader = VideoDownloader()
    listing_info = downloader.fetch_playlist_listing(url)
    content_type = downloader.detect_type(listing_info)
    info = listing_info if content_type == "playlist" else downloader.fetch_info(url)

    if content_type == "playlist":
        entries = get_playlist_entries(info)
        raw_by_url: dict[str, dict] = {}
        raw_by_title: dict[str, dict] = {}
        for raw_entry in info.get("entries") or []:
            if not raw_entry:
                continue
            for url_key in ("webpage_url", "url"):
                value = raw_entry.get(url_key)
                if value and value not in raw_by_url:
                    raw_by_url[value] = raw_entry
            title = raw_entry.get("title")
            if title and title not in raw_by_title:
                raw_by_title[title] = raw_entry

        resolved_entries = []
        for entry in entries:
            raw_match = raw_by_url.get(entry.url) or raw_by_title.get(entry.title)
            thumb_url = extract_thumbnail(raw_match) if raw_match else None
            resolved_entries.append({
                "index": entry.index,
                "title": entry.title,
                "duration": entry.duration,
                "thumbnail": thumb_url
            })

        return {
            "content_type": content_type,
            "title": str(info.get("title") or "Playlist"),
            "available_resolutions": downloader.get_playlist_resolutions(entries),
            "entries": resolved_entries,
        }

    return {
        "content_type": content_type,
        "title": str(info.get("title") or "video"),
        "available_resolutions": downloader.list_available_resolutions(info),
        "thumbnail": extract_thumbnail(info),
    }


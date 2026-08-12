from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path

from api.history import router as history_router
from api.jobs import JobManager
from core.downloader import VideoDownloader, VideoDownloaderError
from core.playlist import get_playlist_entries
from utils.validators import is_valid_url

app = FastAPI(title="YT-Video Downloader API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(history_router)
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
    job = jobs.create_job(
        url=request.url,
        format_type=request.format_type,
        resolution=request.resolution,
        indices=request.indices,
    )
    return {"job_id": job.id}

 

@app.post("/api/cookies")
async def upload_cookies(file: UploadFile = File(...)):
    config_dir = Path(__file__).resolve().parent.parent / "config"
    config_dir.mkdir(parents=True, exist_ok=True)

    cookies_path = config_dir / "cookies.txt"

    content = await file.read()
    cookies_path.write_bytes(content)

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
    try:
        while True:
            event = await job.events.get()
            await websocket.send_json(event)
            if event.get("type") == "job" and event.get("status") in {"completed", "failed"}:
                break
    except WebSocketDisconnect:
        return


def _extract_thumbnail(info_dict: dict) -> str | None:
    if not info_dict:
        return None
    thumb = info_dict.get("thumbnail")
    if isinstance(thumb, str) and thumb:
        return thumb
    thumbnails = info_dict.get("thumbnails")
    if isinstance(thumbnails, list) and thumbnails:
        valid_thumbs = [t for t in thumbnails if isinstance(t, dict) and t.get("url")]
        if valid_thumbs:
            try:
                sorted_thumbs = sorted(
                    valid_thumbs,
                    key=lambda x: int(x.get("width") or 0) * int(x.get("height") or 0),
                    reverse=True
                )
                return sorted_thumbs[0]["url"]
            except Exception:
                return valid_thumbs[-1]["url"]
    return None


def _resolve(url: str) -> dict:
    downloader = VideoDownloader()
    listing_info = downloader.fetch_playlist_listing(url)
    content_type = downloader.detect_type(listing_info)
    info = listing_info if content_type == "playlist" else downloader.fetch_info(url)

    if content_type == "playlist":
        entries = get_playlist_entries(info)
        raw_entries = info.get("entries") or []
        resolved_entries = []
        for entry in entries:
            raw_match = None
            for re in raw_entries:
                if not re:
                    continue
                if re.get("title") == entry.title or re.get("webpage_url") == entry.url or re.get("url") == entry.url:
                    raw_match = re
                    break
            thumb_url = _extract_thumbnail(raw_match) if raw_match else None
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
        "thumbnail": _extract_thumbnail(info),
    }


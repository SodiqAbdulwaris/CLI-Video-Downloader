from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.settings_service import SettingsError, settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    download_directory: str | None = None
    max_concurrent_downloads: int | None = None


@router.get("")
@router.get("/")
async def get_settings() -> dict[str, Any]:
    """Return the currently configured download location and concurrency limit."""
    return settings_service.get_settings()


@router.put("")
@router.put("/")
async def update_settings(payload: SettingsUpdate) -> dict[str, Any]:
    """Persist whichever settings are provided. Rejects invalid values."""
    if payload.download_directory is None and payload.max_concurrent_downloads is None:
        raise HTTPException(status_code=400, detail="Provide at least one setting to update.")

    result: dict[str, Any] = {}
    try:
        if payload.download_directory is not None:
            result.update(settings_service.update_download_directory(payload.download_directory))
        if payload.max_concurrent_downloads is not None:
            result.update(settings_service.update_max_concurrent_downloads(payload.max_concurrent_downloads))
    except SettingsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.settings_service import SettingsError, settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    download_directory: str


@router.get("")
@router.get("/")
async def get_settings() -> dict[str, str | None]:
    """Return the currently configured download location (null when unset)."""
    return settings_service.get_settings()


@router.put("")
@router.put("/")
async def update_settings(payload: SettingsUpdate) -> dict[str, str]:
    """Persist a new download location. Rejects paths the backend cannot use."""
    try:
        return settings_service.update_download_directory(payload.download_directory)
    except SettingsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
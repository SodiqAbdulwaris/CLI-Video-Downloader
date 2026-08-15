from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from services.history_service import history_service

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/recent")
async def get_recent_history(limit: int = Query(default=5, ge=1, le=50)) -> list[dict]:
    return history_service.get_recent_history(limit=limit)


@router.get("")
@router.get("/")
async def get_history() -> list[dict]:
    return history_service.get_history()


@router.get("/{session_id}")
async def get_history_session(session_id: str) -> dict:
    session = history_service.get_history_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="History session not found.")
    return session


@router.delete("")
@router.delete("/")
async def clear_history() -> dict:
    history_service.clear_history()
    return {"success": True, "message": "Download history cleared successfully."}


@router.delete("/{session_id}")
async def delete_history_session(session_id: str) -> dict:
    deleted = history_service.delete_history_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="History session not found.")
    return {"success": True, "message": "History session deleted successfully."}

   

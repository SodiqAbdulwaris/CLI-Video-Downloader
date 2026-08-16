import asyncio
from dataclasses import dataclass, field
from typing import Any

import pytest

from api.main import job_events


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent: list[dict[str, Any]] = []
        self.closed_with: tuple[int, str] | None = None

    async def accept(self):
        self.accepted = True

    async def send_json(self, data):
        self.sent.append(data)

    async def close(self, code=1000, reason=""):
        self.closed_with = (code, reason)


@dataclass
class FakeJob:
    id: str
    status: str
    events: "asyncio.Queue" = field(default_factory=asyncio.Queue)
    last_job_event: dict | None = None


class FakeJobs:
    def __init__(self, job):
        self._job = job

    def get_job(self, job_id):
        return self._job if job_id == self._job.id else None


def test_reconnect_after_completed_job_gets_snapshot_not_a_hang():
    """A client that (re)connects after the job already finished must get an
    immediate status snapshot instead of blocking forever on a queue whose
    terminal event was already drained by an earlier connection."""
    job = FakeJob(id="j1", status="completed")
    ws = FakeWebSocket()

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("api.main.jobs", FakeJobs(job))
        asyncio.run(asyncio.wait_for(job_events(ws, "j1"), timeout=1.0))

    assert ws.accepted is True
    assert ws.sent == [{"type": "job", "status": "completed", "job_id": "j1"}]


def test_reconnect_after_partial_job_also_gets_snapshot():
    job = FakeJob(id="j2", status="partial")
    ws = FakeWebSocket()

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("api.main.jobs", FakeJobs(job))
        asyncio.run(asyncio.wait_for(job_events(ws, "j2"), timeout=1.0))

    assert ws.sent == [{"type": "job", "status": "partial", "job_id": "j2"}]


def test_reconnect_replays_full_last_job_event_including_error():
    """A reconnect snapshot must carry the real terminal event (error message,
    completed/failed counts) when one was recorded, not just a bare status —
    otherwise a client that reconnects after a failure never learns why."""
    stored = {"type": "job", "status": "failed", "job_id": "j4", "error": "boom"}
    job = FakeJob(id="j4", status="failed", last_job_event=stored)
    ws = FakeWebSocket()

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("api.main.jobs", FakeJobs(job))
        asyncio.run(asyncio.wait_for(job_events(ws, "j4"), timeout=1.0))

    assert ws.sent == [stored]


def test_live_job_still_streams_events_until_terminal():
    job = FakeJob(id="j3", status="running")
    ws = FakeWebSocket()

    async def scenario():
        with pytest.MonkeyPatch.context() as mp:
            mp.setattr("api.main.jobs", FakeJobs(job))
            task = asyncio.create_task(job_events(ws, "j3"))
            await job.events.put({"type": "progress", "percent": 50})
            await job.events.put({"type": "job", "status": "completed", "job_id": "j3"})
            await asyncio.wait_for(task, timeout=1.0)

    asyncio.run(scenario())
    assert ws.sent == [
        {"type": "progress", "percent": 50},
        {"type": "job", "status": "completed", "job_id": "j3"},
    ]

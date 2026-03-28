from __future__ import annotations

from core.ffmpeg import check_ffmpeg


def check_dependencies() -> None:
    check_ffmpeg()

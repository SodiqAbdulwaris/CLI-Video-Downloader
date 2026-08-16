from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


class FFmpegError(RuntimeError):
    pass


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise FFmpegError(
            "FFmpeg is not installed or not available on PATH. "
            "Install FFmpeg and try again."
        )


def merge_streams(video_path: Path, audio_path: Path, output_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-i",
        str(audio_path),
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        str(output_path),
    ]
    _run_ffmpeg(command, "Failed to merge video and audio streams.")


def convert_to_mp3(input_path: Path, output_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "0",
        str(output_path),
    ]
    _run_ffmpeg(command, "Failed to convert audio to MP3.")


def _run_ffmpeg(command: list[str], error_message: str) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or "Unknown FFmpeg error."
        raise FFmpegError(f"{error_message} {detail}") from exc

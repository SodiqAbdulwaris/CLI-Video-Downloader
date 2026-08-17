from __future__ import annotations

from download_engine.downloader import VideoDownloader
from download_engine.formats import select_format


def test_select_format_subtitles_needs_no_formats_list():
    selection = select_format(formats=[], preferred_resolution=None, format_type="subtitles")
    assert selection.format_type == "subtitles"
    assert selection.container_extension == "srt"
    assert selection.video_format_id is None
    assert selection.audio_format_id is None


def test_generate_filename_for_subtitles():
    downloader = VideoDownloader.__new__(VideoDownloader)  # skip __init__ (no cookies/env needed)
    selection = select_format(formats=[], preferred_resolution=None, format_type="subtitles")
    filename = downloader.generate_filename(title="My Video", selection=selection, extension="srt")
    assert filename == "My Video_subtitles.srt"

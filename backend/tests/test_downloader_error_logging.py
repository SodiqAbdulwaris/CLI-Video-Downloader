from pathlib import Path
from unittest.mock import patch

import download_engine.downloader as dlmod
from download_engine.downloader import VideoDownloader, VideoDownloaderError
from download_engine.formats import FormatSelection
from download_engine.playlist import PlaylistEntry


def _make_selection():
    return FormatSelection(
        resolution="720p",
        format_type="video",
        container_extension="mp4",
        video_format_id="v",
        audio_format_id="a",
        merged=True,
        video_codec="avc1",
        audio_codec="aac",
        audio_bitrate_kbps=None,
    )


def _make_downloader():
    d = VideoDownloader.__new__(VideoDownloader)
    d._base_options = {}
    return d


def test_download_retry_exhaustion_logs_once_and_marks_exception():
    d = _make_downloader()
    selection = _make_selection()
    log_calls = []

    with patch.object(dlmod, "log_error", lambda **kw: log_calls.append(kw)), \
         patch.object(d, "fetch_info", return_value={"title": "X"}), \
         patch.object(d, "get_formats", return_value=[]), \
         patch.object(d, "select_best_format", return_value=selection), \
         patch.object(d, "_download_once", side_effect=VideoDownloaderError("boom")):

        try:
            d.download(url="https://x", selection=selection, download_path=Path("."), media_type="single")
            assert False, "expected VideoDownloaderError"
        except VideoDownloaderError as exc:
            assert len(log_calls) == 1
            assert getattr(exc, "logged", False) is True


def test_playlist_download_does_not_double_log_already_logged_failure():
    d = _make_downloader()
    log_calls = []
    entry = PlaylistEntry(index=1, title="Video 1", url="https://x", duration=10)

    with patch.object(dlmod, "log_error", lambda **kw: log_calls.append(kw)), \
         patch.object(d, "fetch_playlist_listing", return_value={"title": "PL"}), \
         patch("download_engine.downloader.get_playlist_entries", return_value=[entry]), \
         patch.object(d, "fetch_info", return_value={"title": "Video 1"}), \
         patch.object(d, "get_formats", return_value=[]), \
         patch.object(d, "select_best_format", return_value=_make_selection()), \
         patch.object(d, "download", side_effect=VideoDownloaderError("boom")) as mock_download:
        mock_download.side_effect.logged = True

        result = d.download_playlist(
            url="https://pl", indices=[0], resolution="720p",
            format_type="video", download_path=Path("."), playlist_info={"title": "PL"},
        )

    assert result.failed == 1
    assert len(log_calls) == 0  # already logged inside download(); no duplicate


def test_playlist_download_logs_pre_download_failures():
    d = _make_downloader()
    log_calls = []
    entry = PlaylistEntry(index=1, title="Video 1", url="https://x", duration=10)

    with patch.object(dlmod, "log_error", lambda **kw: log_calls.append(kw)), \
         patch.object(d, "fetch_playlist_listing", return_value={"title": "PL"}), \
         patch("download_engine.downloader.get_playlist_entries", return_value=[entry]), \
         patch.object(d, "fetch_info", side_effect=VideoDownloaderError("metadata fetch failed")):

        result = d.download_playlist(
            url="https://pl", indices=[0], resolution="720p",
            format_type="video", download_path=Path("."), playlist_info={"title": "PL"},
        )

    assert result.failed == 1
    assert len(log_calls) == 1  # never went through download(), so this is the only log point

from core.downloader import _explain_download_error


def test_403_gets_expanded_with_cause_and_next_step():
    raw = "ERROR: unable to download video data: HTTP Error 403: Forbidden"
    explained = _explain_download_error(raw)
    assert "bot-detection" in explained
    assert "cookies.txt" in explained
    assert "README" in explained
    assert raw in explained  # original error preserved for debugging


def test_429_also_gets_expanded():
    raw = "HTTP Error 429: Too Many Requests"
    explained = _explain_download_error(raw)
    assert "bot-detection" in explained


def test_unrelated_error_passes_through_unchanged():
    raw = "[Errno 2] No such file or directory: 'ffmpeg'"
    assert _explain_download_error(raw) == raw

import pytest

from api.jobs import _select_positions
from download_engine.playlist import PlaylistEntry, get_playlist_entries


def test_get_playlist_entries_is_one_based():
    info = {
        "entries": [
            {"title": "First", "webpage_url": "https://x/1"},
            {"title": "Second", "webpage_url": "https://x/2"},
            {"title": "Third", "webpage_url": "https://x/3"},
        ]
    }
    entries = get_playlist_entries(info)
    assert [e.index for e in entries] == [1, 2, 3]


def test_select_positions_maps_one_based_index_to_zero_based_position():
    entries = [
        PlaylistEntry(index=1, title="First", url="https://x/1", duration=None),
        PlaylistEntry(index=2, title="Second", url="https://x/2", duration=None),
        PlaylistEntry(index=3, title="Third", url="https://x/3", duration=None),
    ]
    # Selecting entry.index 1 and 3 (as the frontend sends, matching what
    # /api/resolve returned) must resolve to list positions 0 and 2.
    assert _select_positions(entries, [1, 3]) == [0, 2]


def test_select_positions_none_returns_all():
    entries = [
        PlaylistEntry(index=1, title="First", url="https://x/1", duration=None),
        PlaylistEntry(index=2, title="Second", url="https://x/2", duration=None),
    ]
    assert _select_positions(entries, None) == [0, 1]


def test_select_positions_rejects_zero_based_index():
    entries = [
        PlaylistEntry(index=1, title="First", url="https://x/1", duration=None),
    ]
    # A caller sending 0-based indices (the historical UI bug) must fail
    # loudly rather than silently downloading the wrong item.
    with pytest.raises(ValueError, match="Playlist indices not found: 0"):
        _select_positions(entries, [0])

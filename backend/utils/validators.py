from __future__ import annotations

from urllib.parse import urlparse


def is_valid_url(url: str) -> bool:
    if not url or not url.strip():
        return False
    parsed = urlparse(url.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

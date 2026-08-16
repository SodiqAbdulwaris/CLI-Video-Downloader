from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Allows overriding the downloads root via environment variable so Docker
# containers can bind-mount the host Downloads folder without touching code.
# Falls back to the OS default location when the variable is not set.
_DOWNLOADS_ROOT_ENV = os.environ.get("DOWNLOADS_ROOT")
DOWNLOADS_ROOT = Path(_DOWNLOADS_ROOT_ENV) if _DOWNLOADS_ROOT_ENV else Path.home() / "Downloads" / "YT-Video Downloader"

# Docker bind-mount strategy. When running inside Docker, Compose mounts the
# host download folder at /downloads and sets DOWNLOADS_ROOT=/downloads. The
# backend only ever writes through the container-side path; the host path is
# kept purely for display/validation and never hard-coded in download logic.
RUNNING_IN_DOCKER = _DOWNLOADS_ROOT_ENV is not None
CONTAINER_DOWNLOADS_ROOT = _DOWNLOADS_ROOT_ENV if _DOWNLOADS_ROOT_ENV else "/downloads"
_DOWNLOADS_ROOT_HOST_ENV = os.environ.get("DOWNLOADS_ROOT_HOST")
HOST_DOWNLOADS_ROOT = Path(_DOWNLOADS_ROOT_HOST_ENV) if _DOWNLOADS_ROOT_HOST_ENV else None

# CORS allowlist. Defaults to the Vite dev server's own origins so a browser
# tab on any other site can't call this locally-running API. Override with a
# comma-separated list (e.g. when the frontend runs on a non-default port or
# host) via CORS_ALLOWED_ORIGINS.
_CORS_DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
_CORS_ORIGINS_ENV = os.environ.get("CORS_ALLOWED_ORIGINS")
if _CORS_ORIGINS_ENV:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _CORS_ORIGINS_ENV.split(",") if origin.strip()]
    if not CORS_ALLOWED_ORIGINS:
        # A set-but-empty-after-parsing value (e.g. just commas/whitespace) would
        # otherwise silently produce allow_origins=[] and lock out every browser,
        # including the real frontend. Fall back instead of failing closed.
        logger.warning(
            "CORS_ALLOWED_ORIGINS was set to %r but contained no usable origins; "
            "falling back to the default localhost origins.",
            _CORS_ORIGINS_ENV,
        )
        CORS_ALLOWED_ORIGINS = _CORS_DEFAULT_ORIGINS
else:
    CORS_ALLOWED_ORIGINS = _CORS_DEFAULT_ORIGINS

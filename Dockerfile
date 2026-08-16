FROM python:3.14-slim

WORKDIR /app

# System dependencies required by yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen

COPY download_engine ./download_engine
COPY backend ./backend

EXPOSE 8000

CMD ["uv", "run", "python", "backend/run_api.py"]

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS build

WORKDIR /build

# Install build tools needed by some pip packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS final

# Install ffmpeg (required by core/ffmpeg.py for stream merging / MP3 conversion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from build stage
COPY --from=build /install /usr/local

# Create a non-root user to run the application
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Copy application source (cookies.txt is NOT copied — it is bind-mounted at runtime)
COPY --chown=appuser:appgroup . .

# Ensure the config directory exists so the bind-mount target path is valid
RUN mkdir -p /app/config

USER appuser

# Expose internal port (not published to host — nginx is the public entry point)
EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

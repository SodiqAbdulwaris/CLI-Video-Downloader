# YT Video Downloader

A lightweight YouTube downloader with both a command-line interface and a local web interface, built around `yt-dlp`.

Paste a YouTube URL, choose your download options, and the video, Short, playlist, or audio track lands on your local disk.

<!-- Add a screenshot or short GIF of the web UI here (e.g. docs/images/dashboard.png) -->

## Features

- Download individual YouTube videos
- Download YouTube Shorts
- Download full playlists
- Download selected videos from a playlist
- Extract audio as MP3
- Live download progress over WebSocket
- Persistent local download history
- Re-download a past session with its original settings
- Command-line interface
- Local web interface
- Docker support for the backend
- Configurable download directory
- Cookie import for age-restricted or bot-detection-limited videos

Only what's listed here is implemented. Nothing else is planned or half-built into this repository.

## Tech Stack

- Python, FastAPI
- yt-dlp, FFmpeg
- React, Vite, Tailwind CSS
- Docker (backend only, optional)

## Requirements

- Python 3.14 or later
- [uv](https://docs.astral.sh/uv/) (used to install and run the Python side of this project)
- Node.js 18 or later, with npm
- FFmpeg, available on your system `PATH` (required if you run the backend natively, not through Docker)
- Docker Desktop, only if you want to run the backend in a container

## Installation

### Clone

```bash
git clone <this-repository-url>
cd CLI-Video-Downloader
```

### Backend

Installs both the CLI and the API server's dependencies, since they share the same codebase:

```bash
uv sync
```

### Frontend

```bash
cd frontend
npm install
```

## Usage

### CLI

The CLI shares its download location with the web app, so one has to be configured before the first download. The simplest way is to start the web app once and set a location from Settings, Download Location. Once `backend/data/settings.json` has a location saved, the CLI is ready to use on its own.

Run from the repository root:

```bash
uv run python backend/main.py "<youtube-url>"
```

Example:

```bash
uv run python backend/main.py "https://www.youtube.com/watch?v=jNQXAC9IVRw"
```

If you omit the URL, the CLI prompts for one. It then walks you through resolution and format choices interactively, downloads the file, and prints the saved path.

### Web App

Start the backend:

```bash
uv run python backend/run_api.py
```

The API is now available at `http://127.0.0.1:8000`.

In a separate terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. The dev server proxies API and WebSocket requests to `http://127.0.0.1:8000` automatically, so no configuration is needed if you're running the backend on its default port.

On first run, the app asks you to choose a download folder. Paste a URL, review the resolved title and available resolutions, pick a format, and start the download. Progress updates live over WebSocket.

## Configuration

Configuration is provided through environment variables, loaded from a `.env` file at the repository root (copy `.env.example` to `.env` to start).

| Variable | Description | Required |
|---|---|---|
| `DOWNLOADS_ROOT_HOST` | Host folder bind-mounted into the backend container. Only used when running the backend with Docker. | Yes, in Docker |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed to call the API. Defaults to `http://localhost:5173` and `http://127.0.0.1:5173`. | No |

The frontend has its own `.env` (copy `frontend/.env.example` to `frontend/.env`):

| Variable | Description | Required |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API. Only needed if the backend isn't reachable through the dev server's default proxy (a different port or host). | No |

`DOWNLOADS_ROOT` and `BGUTIL_BASE_URL` also exist as environment variables, but `compose.yaml` sets both automatically when running through Docker; you shouldn't need to set either yourself.

## Supported Downloads

| Type | Supported | Output |
|---|---|---|
| Single video | Yes | Video file (MP4, or the best available container) |
| YouTube Short | Yes | Video file, same as a single video |
| Full playlist | Yes | One file per video, saved into the configured download folder |
| Partial playlist | Yes | One file per selected video |
| Audio only | Yes | MP3 |

Available resolutions depend on what the source video actually offers. All downloads are saved directly into a single configured folder; there are no per-type or per-playlist subfolders.

## Download History

Every completed, partial, or failed download session is recorded locally in:

```text
backend/data/download_history.json
```

The file is created automatically on first use and survives restarts. Each entry stores the source URL, title, media type, format, resolution, per-file status, timestamps, and any errors. It does not store or copy the downloaded media itself.

From the web UI you can view recent sessions, open full history, inspect a session's details, re-download it with its original settings, or delete history entries. Deleting or clearing history only removes the JSON metadata; it never deletes files you've already downloaded.

## Architecture

```text
Browser
  |
  |  http://localhost:5173
  v
Frontend (React + Vite)
  |
  |  HTTP + WebSocket
  v
Backend (FastAPI)
  |  download and job management
  |  history and settings persistence
  v
yt-dlp + FFmpeg
  |
  |  BGUTIL_BASE_URL (Docker only)
  v
bgutil (PO token provider, Docker only)
```

The backend runs `yt-dlp` and `FFmpeg` to fetch and merge streams, manages download jobs, streams progress over WebSocket, and persists history and settings to local JSON files. It can run natively or in Docker. The frontend is a Vite-served React app and is never containerized. `bgutil` is a sidecar container that generates YouTube PO tokens to reduce bot-detection errors; it only exists in the Docker setup.

## Project Structure

```text
.
├── backend/
│   ├── api/            FastAPI routes: resolve, download, history, settings, WebSocket
│   ├── cli/             CLI prompts and display
│   ├── config/           Environment-driven settings
│   ├── core/             Download engine: yt-dlp wrapper, format selection, FFmpeg, playlists
│   ├── services/         History and settings persistence
│   ├── utils/            Filesystem, logging, validation helpers
│   ├── data/             Local JSON history and settings (gitignored)
│   ├── main.py           CLI entry point
│   └── run_api.py        API server entry point
├── frontend/
│   └── src/              React web interface
├── docs/
│   └── agent-log/        Development history, not user documentation
├── compose.yaml
├── Dockerfile
└── README.md
```

`backend/core` is the original download engine; it's what both the CLI and the web API call into. `backend/api` and `backend/cli` are the two interfaces built on top of it.

## Docker

The backend, and only the backend, can run in Docker.

```bash
docker compose up -d --build
```

Stop it with:

```bash
docker compose down
```

`compose.yaml` mounts three volumes: `backend/data` for history and settings, `backend/config` for cookies, and your host download folder (`DOWNLOADS_ROOT_HOST`) at `/downloads` inside the container. The frontend still runs natively with `npm run dev` even when the backend is containerized.

## Troubleshooting

### "A download location has not been configured"

No download folder has been saved in Settings yet. Set one from Settings, Download Location.

### Docker rejects the download location I entered in Settings

The path you entered doesn't match `DOWNLOADS_ROOT_HOST` in `.env`. Enter the exact same absolute path, or change `DOWNLOADS_ROOT_HOST` and restart the container.

### FFmpeg error during a download

FFmpeg isn't installed or isn't on `PATH`. This only applies when running the backend natively; the Docker image already includes it. Run `ffmpeg -version` to confirm it's reachable.

### Backend shows as disconnected in the UI

The backend isn't running or hasn't finished starting. Check `docker compose logs backend`, or the terminal running `run_api.py`.

### Downloads land in the wrong folder

`DOWNLOADS_ROOT_HOST` is misconfigured, for example left as a placeholder, or using a variable like `${HOME}` that isn't set on native Windows. Set it to a real absolute path and confirm with `docker compose config`.

### YouTube returns a 429 or bot-detection error

Your cookies are missing or expired. Export a fresh Netscape-format `cookies.txt` and import it from Settings, Advanced, or place it at `backend/config/cookies.txt`.

### The frontend can't reach the backend ("Failed to fetch")

By default the backend only accepts requests from `http://localhost:5173` and `http://127.0.0.1:5173`. If you're running the frontend elsewhere, set `CORS_ALLOWED_ORIGINS` in `.env` to match.

## Development

Clone the repository and install both sides as described in Installation.

Run the backend and frontend dev servers as described in Usage, Web App.

Before submitting changes, make sure the frontend still builds and lints cleanly:

```bash
cd frontend
npm run build
npm run lint
```

Development notes and the history of past changes live in `docs/agent-log/`. That folder documents why decisions were made; this README documents the project as it exists now.

## License

No license file is currently included in this repository. Until one is added, all rights are reserved by default; treat the code accordingly if you plan to reuse it.

## Disclaimer

This project is provided for educational and personal use. You are responsible for complying with YouTube's Terms of Service, applicable copyright law, and any other laws that apply to you. Only download content you have the right to download.

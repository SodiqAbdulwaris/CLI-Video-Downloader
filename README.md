# YT Video Downloader

A lightweight YouTube downloader with both a command-line interface and a local web interface, built around `yt-dlp`.

Paste a YouTube URL, choose your download options, and the video, Short, playlist, or audio track lands on your local disk.

## Features

- Download individual YouTube videos
- Download YouTube Shorts
- Download full playlists
- Download selected videos from a playlist
- Extract audio as MP3
- Save the video's description alongside the downloaded file
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
uv run python cli/main.py "<youtube-url>"
```

Example:

```bash
uv run python cli/main.py "https://www.youtube.com/watch?v=jNQXAC9IVRw"
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

If a video has a description, it's saved next to the downloaded file as a plain text file with the same name plus `.description.txt`, for example `My Video.mp4` and `My Video.description.txt`. Videos with no description don't get a text file at all.

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
├── download_engine/     Shared download engine: yt-dlp wrapper, format selection,
│                        FFmpeg, playlists, filesystem/logging/validation helpers
├── cli/
│   ├── main.py          CLI entry point
│   ├── interface.py     CLI prompts and display
│   └── progress.py      CLI progress bar
├── cookies/             cookies.txt (gitignored)
├── backend/
│   ├── api/              FastAPI routes: resolve, download, history, settings, WebSocket
│   ├── config/            Backend-specific settings (CORS, Docker downloads root)
│   ├── services/          History and settings persistence
│   ├── data/              Local JSON history and settings (gitignored)
│   └── run_api.py         API server entry point
├── frontend/
│   └── src/              React web interface
├── docs/
│   └── agent-log/        Development history, not user documentation
├── compose.yaml
├── Dockerfile
└── README.md
```

`download_engine/` is the shared download engine; both the CLI and the web API depend on it, not on each other. `backend/api` and `cli/` are the two interfaces built on top of it.

## Docker

Only the backend runs in Docker. The frontend always runs natively with `npm run dev`, even when the backend is containerized.

### Prerequisites

Docker Desktop, with the WSL2 backend on Windows or a native Docker engine on macOS/Linux.

### Setup

1. Copy the example environment file, if you haven't already:

```bash
cp .env.example .env
```

2. Open `.env` and set `DOWNLOADS_ROOT_HOST` to an absolute path on your machine, for example:

```env
DOWNLOADS_ROOT_HOST=C:/Users/YourName/Downloads
```

This is required; `docker compose up` refuses to start without it. Don't use a shell variable like `${HOME}` here, it isn't set on native Windows and resolves to an empty value, which silently points the app at the wrong folder.

3. Build and start the backend:

```bash
docker compose up -d --build
```

This builds the backend image, starts the backend container, and starts a `bgutil` sidecar container that generates YouTube PO tokens to reduce bot-detection errors. The API is now available at `http://127.0.0.1:8000`.

4. Confirm it's running:

```bash
curl http://127.0.0.1:8000/health
```

This should return `{"status":"ok"}`.

5. In a separate terminal, start the frontend exactly as in Usage, Web App:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. In the app, set your download location to the exact same path you set for `DOWNLOADS_ROOT_HOST`. The backend enforces this while running in Docker, since it only ever writes through the bind mount described below; a mismatch is rejected with a clear error (see Troubleshooting).

### Common commands

| Command | What it does |
|---|---|
| `docker compose up -d --build` | Build the image if needed, then start the containers in the background |
| `docker compose down` | Stop and remove the containers |
| `docker compose logs backend` | View backend logs |
| `docker compose logs bgutil` | View the PO token provider's logs |
| `docker compose restart backend` | Restart the backend without rebuilding |
| `docker compose up -d --build backend` | Rebuild just the backend after a code change |
| `docker compose config` | Print the fully resolved configuration, useful for checking what `DOWNLOADS_ROOT_HOST` actually resolved to |

### Volumes

`compose.yaml` mounts three things into the backend container:

| Host path | Container path | Purpose |
|---|---|---|
| `./backend/data` | `/app/backend/data` | Download history and settings, so they survive container restarts and rebuilds |
| `./cookies` | `/app/cookies` | `cookies.txt`, so it can be added or updated without rebuilding the image |
| `DOWNLOADS_ROOT_HOST` (from `.env`) | `/downloads` | Where downloaded files are actually written |

The backend never writes to a host path directly. It only ever writes through the `/downloads` mount, which is why `DOWNLOADS_ROOT_HOST` is required and why the download location chosen in the app has to match it exactly.

### Rebuilding after a code change

`docker compose up -d --build` picks up backend code changes and rebuilds the image. It doesn't reinstall dependencies unless `pyproject.toml` or `uv.lock` changed, since Docker caches that layer separately.

### Stopping

```bash
docker compose down
```

This stops and removes the containers but leaves the three mounted volumes, and everything in them, untouched.

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

### YouTube returns a 403, 429, or bot-detection error

The app now surfaces a short explanation for this in the UI instead of a bare HTTP status code — for example, "YouTube blocked this request — likely bot-detection or an expired cookies.txt, not an app bug." — with a pointer back to this section. Here's the full explanation.

**Cause.** Almost always a missing or stale `cookies/cookies.txt`, not a bug in the app or in `yt-dlp`'s client selection. Without cookies from a real, logged-in browser session, YouTube is far more likely to block stream requests as bot traffic.

**Why "stale" doesn't mean "expired".** The auth cookies YouTube issues (`__Secure-3PSIDTS`, `__Secure-1PSIDTS`, and related `__Secure-*` cookies) carry an expiry timestamp far in the future, so `cookies.txt` can look perfectly valid and still fail. That's because YouTube treats these as *rotating* session tokens: a browser that's still logged in periodically gets reissued a new value, and the server invalidates the previous one — independent of what the old cookie's own expiry field says. A `cookies.txt` exported days or weeks ago can silently stop working even though every timestamp inside it is still in the future. This was confirmed directly: swapping in a freshly-exported `cookies.txt` fixed a previously-403ing download with the exact same code and settings, no code change involved.

**Fix.**

1. In a browser where you're logged into YouTube, export a fresh `cookies.txt` in Netscape format. Browser extensions like "Get cookies.txt LOCALLY" (Chrome/Firefox) do this in one click.
2. Replace `cookies/cookies.txt` with the new export, or upload it from the web UI's Settings, Advanced.
3. Retry the download.

If it 403s again shortly after, the browser you exported from may not be staying logged in (or is also being used to browse YouTube, which rotates the token again and invalidates the copy you just exported). Export again immediately before retrying.

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

### Testing

Backend unit and integration tests live in `backend/tests` and don't touch the network:

```bash
uv run pytest backend/tests
```

A script in that directory is excluded from the `pytest` run on purpose (its `manual_` prefix keeps `pytest`'s default discovery from picking it up) because it performs a real download against YouTube. Run it directly when you need to verify actual download behavior:

```bash
uv run python backend/tests/manual_custom_dir_download.py
```

See [backend/tests/README.md](backend/tests/README.md) for what each test file covers, including a bug-to-regression-test map.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to open a pull request.

Development notes and the history of past changes live in `docs/agent-log/`. That folder documents why decisions were made; this README documents the project as it exists now.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

This project is provided for educational and personal use. You are responsible for complying with YouTube's Terms of Service, applicable copyright law, and any other laws that apply to you. Only download content you have the right to download.

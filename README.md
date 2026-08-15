# 🎬 YT-Video Downloader

A full-stack video and audio downloader powered by **Python (`yt-dlp` + `FFmpeg`)**, **FastAPI**, and **React (Vite + Tailwind CSS)**.

Whether you want to download a high-res 1080p video, convert a music video to MP3, download YouTube Shorts, or extract selective videos from a 50-item playlist, **YT-Video Downloader** handles it with real-time WebSocket progress updates, persistent local download history, and clean output organization on your local disk.

---

## 🌟 Features & What You Can Download

### 📹 Supported Media Types
- **Single YouTube Videos**: Download standard videos up to 4K resolution (720p, 1080p, 1440p, 2160p depending on source availability).
- **YouTube Shorts**: Automatically detected and downloaded like any other single video.
- **Full & Partial Playlists**: Paste a playlist link to inspect all items, select/deselect specific videos, pick a uniform target resolution, and batch download.
- **Audio-Only (MP3 Extraction)**: Automatically extracts audio streams and converts them into high-quality `.mp3` files using FFmpeg.

### ⚡ Key Capabilities
- **📜 Local Download History**: Persistent local JSON history tracking (`backend/data/download_history.json`). View your 5 most recent downloads on the homepage or open the full history view to inspect completed, partial, or failed sessions, view per-file details, re-trigger downloads, or delete history records without affecting downloaded files.
- **⚡ Redownload Support**: Easily re-trigger past download sessions with original configuration settings (source URL, format, quality, playlist selection) creating a new history session entry.
- **📡 Real-Time Live Progress**: Powered by WebSockets — monitor individual video progress percentages and overall playlist batch progress in real time.
- **🎬 Automatic Audio/Video Stream Merging**: Merges best video and audio streams seamlessly via FFmpeg.
- **🛡️ YouTube Bot-Detection Prevention**: Integrated with `bgutil-ytdlp-pot-provider` for PO (Proof-of-Origin) Token generation and supports custom `cookies.txt` import.
- **📂 Configurable Download Location**: Choose the destination folder from the app's Settings screen on first run (or change it any time) — no hard-coded path.
- **🎨 Sleek Modern UI**: Responsive React interface with dark/light mode, thumbnail previews, resolution badges, recent download cards, history modal dialog, and status logs.

---

## 📁 Download Directory & Storage Organization

### Downloaded Files Location
On first run, the app asks you to choose a download folder (Settings → Download Location). Every video, Short, and playlist item is saved directly into that single folder — no per-type or per-playlist subfolders. Existing files are never moved or deleted when you change the location later.

Running via Docker? The folder you pick must be the one bind-mounted into the container — see `DOWNLOADS_ROOT_HOST` in [`.env.example`](.env.example).

### Local History Storage
Metadata for all download sessions is persisted locally on the machine running the backend:

```text
backend/data/download_history.json
```

- Created automatically if missing and survives application restarts.
- Contains session metadata (ID, original URL, title, media type, format, resolution, completion time, status, per-file statuses, and errors).
- Does **not** contain or copy raw video/audio files. Deleting history entries or clearing history only clears local JSON metadata and **never** deletes downloaded media files.

---

## 🛠️ Prerequisites & Requirements

Depending on how you choose to run the application. Either way, the **frontend always runs natively** with Node — only the backend is containerized.

### Option A: Docker Backend (Recommended)
- **Docker Desktop** (with WSL2 backend on Windows, or native Docker engine on macOS/Linux).
- **Node.js 18+** & `npm` (to run the frontend).

### Option B: Fully Native Local Development (No Docker)
- **Python 3.10+**
- **Node.js 18+** & `npm`
- **FFmpeg** installed and accessible in your system `PATH`.

---

## 🚀 Fresh Setup Guide (Step-by-Step)

Choose one of the two setup paths below:

---

### Method A: Docker Backend + Native Frontend (Recommended)

The backend (FastAPI + yt-dlp + the PO token provider) runs in Docker; the frontend runs natively with Vite.

#### Step 1: Configure `.env` File
Copy the example environment file and set `DOWNLOADS_ROOT_HOST` to the host folder you want bind-mounted into the container. This is **required** — `docker compose up` will refuse to start without it:

* **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```
* **macOS / Linux**:
  ```bash
  cp .env.example .env
  ```

```env
# Windows — forward slashes for Docker compatibility
DOWNLOADS_ROOT_HOST=C:/Users/YourUsername/Downloads
# macOS / Linux
DOWNLOADS_ROOT_HOST=/home/yourusername/Downloads
```

#### Step 2: Launch the Backend
```bash
docker compose up -d --build
```
Backend will be available on `http://127.0.0.1:8000`.

#### Step 3: Start the Frontend (Vite React SPA)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend dev server will start on `http://localhost:5173`. The dev server proxies `/api` and `/health` to `http://127.0.0.1:8000` by default, so no frontend config is needed as long as the backend is on its default port. If your backend runs elsewhere (a different port, or Docker on another host), copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL` to that backend's URL.

#### Step 4: Configure the Download Location
Open the app and, in the first-run dialog (or Settings → Download Location), enter the **same path you set for `DOWNLOADS_ROOT_HOST`** — the backend only writes through that bind mount.

---

### Method B: Fully Native Local Development (Without Docker)

Use this setup if you want to modify code or develop features locally without Docker.

#### Step 1: Install FFmpeg
Make sure `ffmpeg` is installed and available in your command line:
* **Windows**: Download build from [ffmpeg.org](https://www.ffmpeg.org/download.html), extract to `C:\ffmpeg`, and add `C:\ffmpeg\bin` to your System Environment Variables `PATH`.
* **macOS**: `brew install ffmpeg`
* **Linux**: `sudo apt install ffmpeg`

Verify:
```bash
ffmpeg -version
```

#### Step 2: Start the Backend (FastAPI)
```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python run_api.py
```
Backend will start on `http://127.0.0.1:8000`.  
Interactive API Documentation is available at `http://127.0.0.1:8000/docs`.

#### Step 3: Start the Frontend (Vite React SPA)
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
Frontend dev server will start on `http://localhost:5173`, proxying `/api` and `/health` to `http://127.0.0.1:8000` by default (see the note in Method A, Step 3, if your backend runs elsewhere).

---

## 📖 How to Use (User Walkthrough)

1. **Paste URL**: Enter any YouTube Video, Short, or Playlist URL into the input field on the Web UI and click **Resolve**.
2. **Review Media**:
   - **Single Video / Short**: View thumbnail, title, and choose your preferred resolution (e.g., 1080p, 720p, 480p) or format (Video vs Audio-Only MP3).
   - **Playlist**: Preview all playlist entries, use checkboxes to select specific videos or click **Select All**, and pick your target resolution.
3. **Start Download**: Click **Start Download**.
4. **Track Live Progress**: Watch the real-time progress bar and log console powered by WebSockets as streams are fetched, merged, or converted.
5. **View Recent Downloads & Local History**:
   - Scroll down to the **Recent Downloads** section to view your 5 most recent sessions.
   - Click the **History** icon in the header (beside theme toggle) or click **View History →** to open the full history dialog.
   - Click **Details** on any history item to see the original URL, target format/quality, saved location, and individual item download statuses or errors.
   - Click **Redownload** to re-download a session using its original configuration.
6. **Access Your Files**: Open the folder you configured in Settings → Download Location to view your newly downloaded media!

---

## 📡 REST API & History Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness health check probe |
| `POST` | `/api/resolve` | Resolve video/playlist metadata & resolutions |
| `POST` | `/api/download` | Queue a new download job |
| `WS` | `/api/ws/{job_id}` | WebSocket live progress updates |
| `GET` | `/api/history` | Retrieve full local download history |
| `GET` | `/api/history/recent?limit=5` | Retrieve the 5 most recent download sessions |
| `GET` | `/api/history/{id}` | Retrieve details for a specific history session |
| `DELETE` | `/api/history/{id}` | Delete a single history entry (metadata only) |
| `DELETE` | `/api/history` | Clear all download history records (metadata only) |

---

## 🔑 YouTube Bot Detection & Cookies Setup

YouTube aggressively limits unauthenticated automated downloads. To ensure smooth operation and prevent bot-detection errors:

1. Install a browser extension like **Get cookies.txt LOCALLY** (for Chrome/Edge/Firefox).
2. Open YouTube while logged into an account and export your cookies in **Netscape format**.
3. Save the exported file to `backend/config/cookies.txt`.
4. **Note for Docker**: `./backend/config` is bind-mounted into the container (`./backend/config:/app/backend/config`), so you can drop/update `cookies.txt` there — or import it via Settings → Advanced in the UI — without rebuilding the container.

---

## 🏗️ Project Architecture & Docker Topology

```text
Browser
  │
  ├── http://localhost:5173  ──────────►  React SPA (Vite dev server, native)
  │                                            │ fetch /api/*, ws /api/ws/*
  ▼                                            ▼
http://localhost:8000  ─────────────►  ┌──────────────────────────┐
                                        │   backend (FastAPI)      │
                                        │   uvicorn :8000           │
                                        │   (Docker or native)      │
                                        └────────────┬──────────────┘
                                                      │ BGUTIL_BASE_URL
                                        ┌─────────────▼─────────────┐
                                        │      bgutil :4416         │
                                        │  (Docker only)             │
                                        └────────────────────────────┘
```

* **Backend**: FastAPI app running `yt-dlp` and `FFmpeg`, managing download jobs over WebSocket and persisting history/settings to `backend/data/*.json`. Runs on port 8000 either via Docker (`compose.yaml`) or natively (`run_api.py`).
* **bgutil**: the Compose service name for the `brainicism/bgutil-ytdlp-pot-provider` container, offering YouTube PO Token generation for `yt-dlp`. The backend finds it via `BGUTIL_BASE_URL=http://bgutil:4416` (Docker's internal DNS resolves `bgutil` to this container). Only present in the Docker setup (Method A) — use `docker compose logs bgutil` to inspect it; native-only setups run without it.
* **Frontend**: React SPA served by the Vite dev server (or a static build) — never containerized, and talks to the backend directly over plain HTTP/WS.

---

## ❓ Troubleshooting

| Issue / Symptom | Probable Cause | Solution |
|---|---|---|
| **"A download location has not been configured"** | No download folder chosen yet, or (Docker) the chosen path doesn't match the bind mount. | Set it via Settings → Download Location. In Docker it must exactly match `DOWNLOADS_ROOT_HOST` in `.env`. |
| **FFmpeg Error during audio download** | FFmpeg missing on PATH in a fully-native (non-Docker) setup. | Install `ffmpeg` and ensure `ffmpeg -version` works in command prompt. |
| **Backend unreachable / "disconnected" status** | Backend container still starting, failing healthcheck, or not running. | Run `docker compose logs backend` (Docker) or check the `run_api.py` terminal for Python startup errors. |
| **Downloads landing in container instead of host** | `DOWNLOADS_ROOT_HOST` path incorrect in `.env`, or app's configured location doesn't match it. | Verify the `.env` path uses forward slashes (e.g. `C:/Users/name/Downloads`) and matches what's set in Settings. |
| **YouTube 429 / Bot Detection Error** | Expired or missing YouTube cookies. | Import a fresh Netscape `cookies.txt` via Settings → Advanced, or update `backend/config/cookies.txt` directly. |

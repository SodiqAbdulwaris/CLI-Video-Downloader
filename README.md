# 🎬 YT-Video Downloader

A full-stack, production-grade video and audio downloader powered by **Python (`yt-dlp` + `FFmpeg`)**, **FastAPI**, **React (Vite + Tailwind CSS)**, and **Nginx**.

Whether you want to download a high-res 1080p video, convert a music video to MP3, download YouTube Shorts, or extract selective videos from a 50-item playlist, **YT-Video Downloader** handles it with real-time WebSocket progress updates and clean output organization on your local disk.

---

## 🌟 Features & What You Can Download

### 📹 Supported Media Types
- **Single YouTube Videos**: Download standard videos up to 4K resolution (720p, 1080p, 1440p, 2160p depending on source availability).
- **YouTube Shorts**: Automatically detected and saved into a dedicated `Shorts/` folder.
- **Full & Partial Playlists**: Paste a playlist link to inspect all items, select/deselect specific videos, pick a uniform target resolution, and batch download.
- **Audio-Only (MP3 Extraction)**: Automatically extracts audio streams and converts them into high-quality `.mp3` files using FFmpeg.

### ⚡ Key Capabilities
- **Real-Time Live Progress**: Powered by WebSockets — monitor individual video progress percentages and overall playlist batch progress in real time.
- **Automatic Audio/Video Stream Merging**: Merges best video and audio streams seamlessly via FFmpeg.
- **YouTube Bot-Detection Prevention**: Integrated with `bgutil-ytdlp-pot-provider` for PO (Proof-of-Origin) Token generation and supports custom `cookies.txt` import.
- **Local Host Downloads Integration**: Saves downloaded files directly to your machine's native `Downloads/YT-Video Downloader/` directory.
- **Sleek Modern UI**: Responsive React interface with dark/light mode, thumbnail previews, resolution badges, and status logs.
- **Locally-Trusted HTTPS**: Docker deployment uses `mkcert` for locally-trusted SSL certificates (`https://ytdownloader.local`).

---

## 📁 Download Directory Organization

Downloads land directly in your machine's **Downloads** folder, organized neatly by type:

```text
📁 Your User Downloads/
└── 📁 YT-Video Downloader/
    ├── 📁 Single Videos/       # Standard YouTube video downloads (.mp4)
    ├── 📁 Shorts/              # YouTube Shorts downloads (.mp4)
    └── 📁 Playlists/           # Playlist downloads
        └── 📁 <Playlist Title>/# Individual playlist folders
    ├── 📄 download_history.log # Log of all completed downloads
```

---

## 🛠️ Prerequisites & Requirements

Depending on how you choose to run the application:

### Option A: Docker Deployment (Recommended for Production)
- **Docker Desktop** (with WSL2 backend on Windows, or native Docker engine on macOS/Linux).
- **mkcert** (for issuing trusted local HTTPS certificates).

### Option B: Native Local Development (No Docker)
- **Python 3.10+**
- **Node.js 18+** & `npm`
- **FFmpeg** installed and accessible in your system `PATH`.

---

## 🚀 Fresh Setup Guide (Step-by-Step)

Choose one of the two setup paths below:

---

### Method A: Production Docker Setup (Recommended)

Follow these steps to run the complete production stack (Nginx + FastAPI Backend + PO Token Provider + React SPA) with local HTTPS.

#### Step 1: Install `mkcert` and Local CA
`mkcert` creates a locally-trusted certificate authority so your browser won't display SSL warnings on `https://ytdownloader.local`.

* **Windows (via Scoop or Chocolatey)**:
  ```powershell
  scoop install mkcert
  # OR
  choco install mkcert
  ```
* **macOS**:
  ```bash
  brew install mkcert
  ```
* **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt install libnss3-tools
  curl -Lo mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v*-linux-amd64
  chmod +x mkcert && sudo mv mkcert /usr/local/bin/
  ```

Run this command **once** to register the root CA in your system and browser trust stores:
```bash
mkcert -install
```

#### Step 2: Generate TLS Certificates
Navigate to the `nginx/certs` directory and issue a certificate for `ytdownloader.local`:

* **Windows (PowerShell)**:
  ```powershell
  cd nginx/certs
  mkcert ytdownloader.local
  cd ../..
  ```
* **macOS / Linux**:
  ```bash
  cd nginx/certs
  mkcert ytdownloader.local
  cd ../..
  ```

This creates `ytdownloader.local.pem` and `ytdownloader.local-key.pem` inside `nginx/certs/`.

#### Step 3: Add Hostname to your Hosts File
Map `ytdownloader.local` to `127.0.0.1` on your host OS.

* **Windows**: Open Notepad **as Administrator** and edit `C:\Windows\System32\drivers\etc\hosts`:
  ```text
  127.0.0.1   ytdownloader.local
  ```
* **macOS / Linux**:
  ```bash
  echo "127.0.0.1   ytdownloader.local" | sudo tee -a /etc/hosts
  ```

#### Step 4: Configure `.env` File
Copy the example environment file:

* **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```
* **macOS / Linux**:
  ```bash
  cp .env.example .env
  ```

Open `.env` and set `DOWNLOADS_ROOT_HOST` to your user Downloads directory path:

* **Windows (use forward slashes for Docker compatibility)**:
  ```env
  DOWNLOADS_ROOT_HOST=C:/Users/YourUsername/Downloads
  ```
* **macOS / Linux**:
  ```env
  DOWNLOADS_ROOT_HOST=/home/yourusername/Downloads
  ```

#### Step 5: Ensure `cookies.txt` Exists
Create an empty `cookies.txt` file if you don't have one yet (you can update it with real YouTube session cookies later):

* **Windows (PowerShell)**:
  ```powershell
  New-Item -Force backend/config/cookies.txt
  ```
* **macOS / Linux**:
  ```bash
  touch backend/config/cookies.txt
  ```

#### Step 6: Build & Launch Docker Stack
```bash
docker compose up -d --build
```

#### Step 7: Access the Application!
Open your browser and visit:
👉 **[https://ytdownloader.local](https://ytdownloader.local)**

---

### Method B: Native Local Development (Without Docker)

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
Frontend dev server will start on `http://localhost:5173`.

---

## 📖 How to Use (User Walkthrough)

1. **Paste URL**: Enter any YouTube Video, Short, or Playlist URL into the input field on the Web UI and click **Resolve**.
2. **Review Media**:
   - **Single Video / Short**: View thumbnail, title, and choose your preferred resolution (e.g., 1080p, 720p, 480p) or format (Video vs Audio-Only MP3).
   - **Playlist**: Preview all playlist entries, use checkboxes to select specific videos or click **Select All**, and pick your target resolution.
3. **Start Download**: Click **Start Download**.
4. **Track Live Progress**: Watch the real-time progress bar and log console powered by WebSockets as streams are fetched, merged, or converted.
5. **Access Your Files**: Open your system's `Downloads/YT-Video Downloader/` folder to view your newly downloaded media!

---

## 🔑 YouTube Bot Detection & Cookies Setup

YouTube aggressively limits unauthenticated automated downloads. To ensure smooth operation and prevent bot-detection errors:

1. Install a browser extension like **Get cookies.txt LOCALLY** (for Chrome/Edge/Firefox).
2. Open YouTube while logged into an account and export your cookies in **Netscape format**.
3. Save the exported file to `backend/config/cookies.txt`.
4. **Note for Docker**: `cookies.txt` is read-only bind-mounted into the container (`./backend/config/cookies.txt:/app/config/cookies.txt:ro`). You can update this file on your host machine at any time without rebuilding the container.

---

## 🏗️ Project Architecture & Docker Topology

```text
Browser (HTTPS)
      │
      ▼
┌─────────────┐  :80 (HTTP redirect) ┌──────────────────────────────────┐
│    Nginx    │  :443 (TLS)          │       ytdl-net (Bridge)          │
│  Container  │◄────────────────────►│                                  │
│  (Public)   │   /api/* (HTTP)      │  ┌──────────────────────────┐    │
└─────────────┘─────────────────────►│  │   backend (FastAPI)      │    │
       │          /api/ws/* (WS)     │  │   uvicorn :8000          │    │
       │                             │  └────────────┬─────────────┘    │
       │                             │               │ POT_PROVIDER_BASE_URL
       │                             │  ┌────────────▼─────────────┐    │
       │                             │  │  bgutil-provider :4416   │    │
       │                             │  └──────────────────────────┘    │
       │                             └──────────────────────────────────┘
       │  Static React Assets
       └── / -> Served by Nginx static root
```

* **Nginx**: Acts as the sole public gateway on ports 80/443. Terminates TLS via `mkcert` certificates, serves built static React frontend assets, proxies `/api/*` REST endpoints, and proxies `/api/ws/*` WebSocket connections with HTTP Upgrade headers.
* **Backend**: FastAPI app isolated inside `ytdl-net`. Runs `yt-dlp` and `FFmpeg` non-root inside the container.
* **bgutil-provider**: `brainicism/bgutil-ytdlp-pot-provider` container offering YouTube PO Token generation for `yt-dlp`.

---

## ❓ Troubleshooting

| Issue / Symptom | Probable Cause | Solution |
|---|---|---|
| **SSL / Certificate Warning in Browser** | `mkcert` CA not installed in browser trust store. | Run `mkcert -install`, restart browser. For Firefox, manually import root CA from `mkcert -CAROOT`. |
| **`ytdownloader.local` host not found** | Missing `/etc/hosts` or Windows hosts entry. | Add `127.0.0.1 ytdownloader.local` to system hosts file. |
| **FFmpeg Error during audio download** | FFmpeg missing on PATH in non-Docker setup. | Install `ffmpeg` and ensure `ffmpeg -version` works in command prompt. |
| **502 Bad Gateway from Nginx** | Backend container still starting or failing healthcheck. | Run `docker compose logs backend` to inspect Python startup errors. |
| **Downloads landing in container instead of host** | `DOWNLOADS_ROOT_HOST` path incorrect in `.env`. | Verify absolute path in `.env` uses forward slashes (e.g. `C:/Users/name/Downloads`). |
| **YouTube 429 / Bot Detection Error** | Expired or missing YouTube cookies. | Update `backend/config/cookies.txt` with fresh Netscape cookies exported from your browser. |

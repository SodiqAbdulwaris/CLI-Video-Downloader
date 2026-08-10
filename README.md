# CLI Video Downloader

A CLI-based video downloader built with Python, `yt-dlp`, and `FFmpeg`. It allows users to download single videos, YouTube Shorts, and playlists. Users are also able to download selected parts of playlists and audios. Everything being downloaded can be downloaded in different available resolutions.

## Setup

1. Create and activate a virtual environment.
2. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

## Project Structure

- `backend/` contains the Python downloader application. `backend/api/` provides the FastAPI layer.
- `frontend/` is reserved for a future React SPA and is not implemented yet.
- `Downloads/` at the repository root is the legacy download directory. It is no longer used for new downloads and can be cleaned up manually when no longer needed.

## Install FFmpeg

### Windows

## Installing FFmpeg

1. Download FFmpeg from the [official website](https://www.ffmpeg.org/download.html)
2. Choose the **Windows build** and download the ZIP file
3. Extract the ZIP file to a location (e.g., `C:\ffmpeg`)
4. Add FFmpeg to your system PATH:
   - Press **Win + S**, type **Edit System Environment Variables**
   - Click **Environment Variables**
   - Under **System variables**, find and select `Path`, then click **Edit**
   - Click **New** and add the path to the `bin` folder (e.g., `C:\ffmpeg\bin`)
   - Click **OK** to save
5. Verify the installation:
   - Open command prompt
   - Run: `ffmpeg -version`
   - You should see FFmpeg version information

### macOS

```bash
brew install ffmpeg
```

### Linux

```bash
sudo apt install ffmpeg
```

## How to use

```bash
cd backend
python main.py <youtube video or playlist link>
```

OR

```bash
cd backend
python main.py
```

## API server

From `backend/`, start the local API server with:

```bash
python run_api.py
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`. The API exposes `POST /api/resolve`, `POST /api/download`, and `WS /api/ws/{job_id}`. `indices` supplied to a playlist download use the entry indices returned by `/api/resolve`.


## YouTube Cookie Authentication

To reduce YouTube bot-detection errors, export a Netscape-format `cookies.txt` directly from a browser session logged into YouTube, for example with the "Get cookies.txt LOCALLY" extension, and place it at `backend/config/cookies.txt`. Re-export it periodically because YouTube session cookies expire. Never share this file or commit it to git.

## Download Layout

```text
<OS user Downloads>/
└── YT-Video Downloader/
    ├── Single Videos/
    ├── Shorts/
    └── Playlists/
        └── Playlist_Title/
```

## Troubleshooting

- `FFmpeg is not installed`: install FFmpeg and ensure it is available on `PATH`
- `Invalid URL`: provide a full link
    - Get link by right clicking the video and clicking **Copy Video URL**
- Successful downloads are recorded in `<OS user Downloads>/YT-Video Downloader/download_history.log`
- Playlist item failures: check `backend/errors.log`; the downloader continues with remaining videos
- Missing output file after download: retry the download and verify the source URL is still available

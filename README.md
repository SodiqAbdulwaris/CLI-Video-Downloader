# CLI Video Downloader

A CLI-based video downloader built with Python, `yt-dlp`, and `FFmpeg`. It allows users to download single videos, YouTube Shorts, and playlists. Users are also able to download selected parts of playlists and audios. Everything being downloaded can be downloaded in different available resolutions.

## Setup

1. Create and activate a virtual environment.
2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

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
python main.py <youtube video or playlist link>
```

OR

```bash
python main.py
```


## YouTube Cookie Authentication

To reduce YouTube bot-detection errors, export a Netscape-format `cookies.txt` directly from a browser session logged into YouTube, for example with the "Get cookies.txt LOCALLY" extension, and place it at `config/cookies.txt`. Re-export it periodically because YouTube session cookies expire. Never share this file or commit it to git.

## Download Layout

```text
Downloads/
├── Single Videos/
├── Shorts/
└── Playlists/
    └── Playlist_Title/
```

## Troubleshooting

- `FFmpeg is not installed`: install FFmpeg and ensure it is available on `PATH`
- `Invalid URL`: provide a full link
    - Get link by right clicking the video and clicking **Copy Video URL**
- Successful downloads are recorded in `C:\Users\HP\Videos\CLI-Video-Downloads\download_history.log`
- Playlist item failures: check `errors.log`; the downloader continues with remaining videos
- Missing output file after download: retry the download and verify the source URL is still available

# Project: CLI Video Downloader (yt-dlp + FFmpeg)

## Overview
Build a fully functional, production-ready command-line (CLI) video downloader in Python using yt-dlp and FFmpeg.

The application must:
- Be CLI-based only (NO GUI)
- Be modular and scalable
- Follow clean architecture principles
- Be robust enough for real-world usage

Do NOT use UI/formatting libraries (e.g., rich). Keep output simple using print statements.

---

## Core Technologies

- yt-dlp (Python API preferred)
- FFmpeg (external dependency via subprocess)
- Python 3.x

They are already installed in the virtual environment.

---

## Project Structure (MANDATORY)

The generated project MUST follow this exact structure:

```
<Current Directory>/
│
├── main.py
├── requirements.txt
├── README.md
├── .env/
│
├── core/
│   ├── __init__.py
│   ├── downloader.py
│   ├── formats.py
│   ├── playlist.py
│   ├── ffmpeg.py
│
├── cli/
│   ├── __init__.py
│   ├── interface.py
│   ├── progress.py
│
├── utils/
│   ├── __init__.py
│   ├── validators.py
│   ├── file_utils.py
│   ├── system.py
│
└── config/
    ├── __init__.py
    └── settings.py
```

---

## Functional Requirements

### 1. URL Handling

- Accept URL via:
  - Command line argument: `python main.py <URL>`
  - Interactive prompt (if no URL provided)
  
- Detect:
  - Single video
  - Playlist
  - YouTube Shorts

- Validate URL and handle invalid inputs gracefully

---

## 2. Metadata Extraction

Use yt-dlp with:
- `extract_info(download=False)`

### For Single Video:
Display:
- Title
- Duration
- Available resolutions
- Video type (regular video or Short)

### For Playlist:
Display:
- Playlist title
- Number of videos
- Indexed list of videos (with titles)

---

## 3. Format & Resolution Selection

### Automatic Resolution Selection (Smart Defaults):

**Priority order:**
1. 720p (if available)
2. 480p (if 720p not available)
3. Best available (if neither 720p nor 480p exist)

### User Override:
- Allow user to manually select resolution when prompted
- Display available resolutions extracted from yt-dlp metadata
- Group formats by resolution
- Prefer MP4 when available

---

## 4. Audio Options

Allow:
- Download video with audio (default)
- Download audio only

If audio-only:
- Convert to MP3 using FFmpeg
- Maintain original audio quality

---

## 5. Playlist Support

When playlist detected, ask:
- "Download full playlist or select specific videos? (full/select)"

### If FULL:
- Ask for resolution preference (or use default: 720p → 480p → best)
- Ask for format (video/audio)
- Download all videos sequentially
- Display progress: "Downloading video X of Y: [Title]"

### If SELECT:
- Allow user to specify:
  - Individual indices (e.g., 1, 3, 5)
  - Ranges (e.g., 1-5, 10-15)
  - Mix of both (e.g., 1, 3, 5-8, 12)
- Validate indices against playlist length
- Download only selected videos

### Playlist Progress Tracking:
- Show current video index
- Show total videos
- Show individual video download progress
- Handle partial failures gracefully (skip failed videos, continue with others)

---

## 6. Download Logic

Use yt-dlp Python API:
- Do NOT rely entirely on subprocess unless necessary

### Requirements:
- Implement progress hooks
- Display real-time progress:
  - Percentage completed
  - Download speed
  - ETA (estimated time remaining)
  - Current file size

### Progress Display Format:
```
Downloading: [Title]
Progress: 45.2% | Speed: 2.5 MB/s | ETA: 00:25 | Size: 12.3 MB
```

---

## 7. Format Handling (CRITICAL)

- yt-dlp often provides:
  - Video-only streams
  - Audio-only streams

Your implementation MUST:
- Detect when streams are separate
- Download both streams automatically
- Merge using FFmpeg
- Clean up temporary files after merge

---

## 8. FFmpeg Integration

Use subprocess to:
- Merge video + audio streams
- Convert audio to MP3
- Maintain quality during conversion

**Dependency Check:**
- Detect if FFmpeg is installed on system startup
- If missing, display clear error message with installation instructions
- Exit gracefully if FFmpeg not found

---

## 9. File Naming Convention (CRITICAL)

**All downloaded files MUST include format information in the filename:**

### For Video Files:
```
[title]_[resolution]_[video_codec]+[audio_codec].[extension]

Examples:
- How_to_Code_in_Python_720p_h264+aac.mp4
- Best_Moments_2024_1080p_vp9+opus.webm
- Tutorial_Part_1_480p_h264+aac.mp4
```

### For Audio-Only Files:
```
[title]_audio_[audio_codec]_[bitrate].[extension]

Examples:
- Podcast_Episode_5_audio_mp3_128kbps.mp3
- Music_Track_audio_opus_192kbps.opus
```

### For Playlist Videos:
```
[index]_[title]_[resolution]_[video_codec]+[audio_codec].[extension]

Examples:
- 01_Introduction_720p_h264+aac.mp4
- 02_Chapter_One_720p_h264+aac.mp4
- 15_Conclusion_480p_h264+aac.mp4
```

### Filename Sanitization Rules:
- Replace spaces with underscores
- Remove special characters: / \ : * ? " < > |
- Limit filename length to 200 characters
- Preserve important metadata in shortened names

---

## 10. Download Location (CRITICAL)

**Organized folder structure:**

```
Downloads/
├── Single Videos/
│   └── [video_title]_[resolution]_[codecs].mp4
│
├── Shorts/
│   └── [short_title]_[resolution]_[codecs].mp4
│
└── Playlists/
    └── [Playlist Title]/
        ├── 01_[video_title]_[resolution]_[codecs].mp4
        ├── 02_[video_title]_[resolution]_[codecs].mp4
        └── ...
```

**Rules:**
- Single regular videos → `Single Videos/`
- YouTube Shorts → `Shorts/`
- Playlist videos → `Playlists/[Playlist Title]/`
- Prefix playlist videos with zero-padded index (01_, 02_, ..., 10_, 11_)
- Sanitize folder/file names (remove invalid characters)
- Create folders automatically if they don't exist
- Include format info in every filename

---

## 11. Error Handling

Handle:
- Invalid URLs
- Network failures (timeout, connection errors)
- Missing dependencies (FFmpeg)
- Unsupported formats
- Age-restricted content
- Private/unavailable videos
- Playlist partial failures (skip failed items, log errors, continue)
- Disk space issues
- Permission errors
- Filename conflicts (append number if duplicate)

**Error Recovery:**
- Retry failed downloads (max 3 attempts)
- Skip corrupted videos in playlists
- Continue playlist download even if individual videos fail

---

## 12. Error Logging

Create and maintain `errors.log` file

**Log format:**
```
[2026-03-28 14:35:22] ERROR
URL: https://example.com/video
Type: Single Video / Playlist / Short
Resolution: 720p
Format: video+audio / audio-only
Codec: h264+aac
Download Path: Downloads/Single Videos/
Filename: Video_Title_720p_h264+aac.mp4
Error Message: [Detailed error description]
---
```

**Logging events:**
- Failed downloads
- Network errors
- FFmpeg merge failures
- Invalid format selections
- Filename conflicts
- Any exception raised

---

## CLI Flow

### Single Video:

1. User runs:
   ```bash
   python main.py https://example.com/video
   # OR
   python main.py  # Interactive mode, prompts for URL
   ```

2. App:
   - Validates URL
   - Fetches metadata
   - Detects video type (regular/Short)
   - Displays: title, duration, available resolutions

3. Prompts:
   - "Select resolution (or press Enter for auto: 720p→480p→best):"
   - "Download format? (1) Video+Audio (2) Audio only:"

4. Downloads with real-time progress display

5. Saves to appropriate folder with format in filename:
   - `Single Videos/Video_Title_720p_h264+aac.mp4`
   - `Shorts/Short_Title_720p_h264+aac.mp4`

---

### Playlist:

1. User runs:
   ```bash
   python main.py https://example.com/playlist
   # OR
   python main.py  # Interactive mode
   ```

2. App:
   - Validates URL
   - Fetches playlist metadata
   - Displays:
     - Playlist title
     - Total videos
     - Indexed list (e.g., "1. Video Title | Duration")

3. Prompts:
   - "Download full playlist or select specific videos? (full/select):"
   - If select: "Enter video numbers (e.g., 1,3,5 or 1-5 or 1,3-7,10):"
   - "Select resolution (or press Enter for auto: 720p→480p→best):"
   - "Download format? (1) Video+Audio (2) Audio only:"

4. Downloads sequentially:
   - Shows: "Downloading 3 of 15: [Video Title]"
   - Shows individual progress for each video

5. Saves to `Playlists/[Playlist Title]/` with format in filename:
   - `01_Video_Title_720p_h264+aac.mp4`
   - `02_Another_Video_1080p_h264+aac.mp4`

---

## Architecture Requirements

### Downloader Class

Implement a structured class:

```python
class VideoDownloader:
    def fetch_info(self, url): 
        """Extract video/playlist metadata"""
        pass
    
    def detect_type(self, info): 
        """Detect: single video, playlist, or Short"""
        pass
    
    def get_formats(self, info): 
        """Get available resolutions/formats with codec info"""
        pass
    
    def select_best_format(self, formats, preferred_res='720p'): 
        """Auto-select: 720p → 480p → best"""
        pass
    
    def generate_filename(self, title, resolution, video_codec, audio_codec, extension):
        """Generate filename with format info"""
        pass
    
    def download(self, url, format_id, download_path): 
        """Download with progress tracking"""
        pass
    
    def download_playlist(self, url, indices, resolution, format_type): 
        """Handle playlist downloads"""
        pass
```

---

### Separation of Concerns

- **core/** handles ALL download logic, format selection, metadata extraction, filename generation
- **cli/** handles user interaction, prompts, input validation ONLY
- **utils/** handles file operations, URL validation, system checks, filename sanitization
- **config/** stores settings (default resolution, download paths, retry attempts, filename patterns)

---

## Performance Requirements

- Prevent blocking operations (use efficient loops)
- Download playlist videos sequentially (avoid parallel downloads for stability)
- Clean up temporary files immediately after merge
- Avoid redundant metadata fetches
- Implement connection timeout (30 seconds default)

---

## Constraints

- Must be fully functional (no pseudo-code or placeholders)
- Must handle real yt-dlp edge cases (separate streams, formats, etc.)
- Code must be modular, readable, and well-commented
- Minimal dependencies (only yt-dlp in requirements.txt)
- Must work cross-platform (Windows, macOS, Linux)
- Filenames MUST include format information

---

## Output Requirements

Generate complete working Python project with:

1. **Complete file structure** (all folders and files)
2. **requirements.txt** (yt-dlp only)
3. **README.md** with:
   - Project description
   - Features list
   - Setup instructions (virtual environment)
   - How to install FFmpeg (platform-specific)
   - Usage examples (single video, playlist, Shorts)
   - Filename format explanation
   - Troubleshooting section
4. **Fully functional code** (no TODOs or placeholders)

---

## Example Usage

```bash
# Single video
python main.py https://youtube.com/watch?v=example
# Output: Single Videos/Python_Tutorial_720p.mp4

# Playlist
python main.py https://youtube.com/playlist?list=example
# Output: Playlists/Python Course/01_Introduction_720p.mp4
#         Playlists/Python Course/02_Variables_720p.mp4

# YouTube Short
python main.py https://youtube.com/shorts/example
# Output: Shorts/Coding_Tip_720p.mp4

# Audio only
# Output: Single Videos/Podcast_audio.mp3

# Interactive mode
python main.py
> Enter URL: https://youtube.com/watch?v=example
```

---

## Example Filenames

### Single Videos:
- `Machine_Learning_Basics_720p.mp4`
- `React_Tutorial_1080p.webm`
- `Quick_Tip_480p.mp4`

### Playlist Videos:
- `01_Course_Introduction_720p.mp4`
- `02_Setting_Up_Environment_720p.mp4`
- `15_Final_Project_1080p.mp4`

### Audio Files:
- `Podcast_Episode_12_audio.mp3`
- `Audiobook_Chapter_1_audio.opus`

### Shorts:
- `Python_One_Liner_720p.mp4`
- `Coding_Hack_480p.mp4`

---


## Goal

Build a powerful, production-ready CLI video downloader with:
- Intelligent resolution selection (720p → 480p → best)
- Organized folder structure (Single Videos, Shorts, Playlists)
- Full playlist support with flexible selection
- Audio extraction (MP3 conversion)
- Robust error handling and logging
- Clean, maintainable codebase

The result should be a professional-grade tool that rivals commercial downloaders in functionality while maintaining simplicity and modularity. The filename convention ensures users always know the format and quality of their downloaded content at a glance.

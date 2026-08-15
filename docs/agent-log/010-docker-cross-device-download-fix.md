# 010: Fix Docker downloads failing with a cross-device link error

Asked to confirm the Docker image and compose setup are actually well configured for someone wanting to use Docker. Rather than only reading `Dockerfile` and `compose.yaml`, built the image and ran the full stack (`docker compose up -d --build`) against a real bind-mounted host folder and drove a real download through it.

The image built cleanly and both containers started healthy, but the first real download through the containerized backend failed:

```text
[Errno 18] Invalid cross-device link: '/tmp/yt_downloader_rgr90krm/muxed_stream.mp4' -> '/downloads/Me at the zoo_240p_avc1.mp4'
```

`backend/core/downloader.py` downloads into a `tempfile.TemporaryDirectory()` first, then moves the finished file into the target folder. For plain progressive downloads (a single stream that does not need FFmpeg to merge video and audio, which is what most low-resolution videos use) that move was `downloaded.replace(final_path)`, i.e. `Path.replace()` / `os.replace()`. An OS-level rename like that can only work within a single filesystem. In Docker, the temp directory lives on the container's own writable layer while the downloads folder is a separate bind-mounted volume, so the two are different devices and the rename raises `EXDEV` every time. This affected every progressive-format download in the Docker setup; it did not affect merged video+audio downloads or audio-only downloads, since both of those write their output directly through FFmpeg (`merge_streams` / `convert_to_mp3`) rather than renaming a temp file.

This was a real, always-reproducing bug in the Docker path, not an edge case: the very first test video used in this session (`jNQXAC9IVRw`) only offers progressive streams, so it hit this exact failure on the first try.

Fixed by replacing the rename with `shutil.move()`, which retries as a copy-plus-delete when the OS-level rename fails with `EXDEV`, and works identically to a plain rename when source and destination are already on the same filesystem (the native, non-Docker case).

## Verification
- Rebuilt the image and reran the stack after the fix.
- Progressive download (240p) through Docker, bind-mounted to a real Windows host path (`C:/Users/.../Temp/...`, matching what `.env.example` documents): completed, file verified on the actual host filesystem, not just inside the container.
- Audio-only download through the same running stack: completed, confirming the FFmpeg-based paths were unaffected, as expected.
- Native (non-Docker) progressive download after the fix: completed, confirming `shutil.move()` still behaves correctly on a single filesystem.
- Torn down containers, removed the test image, and cleaned up test downloads and `.env` afterward.

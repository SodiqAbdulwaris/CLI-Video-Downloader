from __future__ import annotations


def create_progress_hook(title: str):
    last_line = {"value": ""}

    def hook(status: dict) -> None:
        if status.get("status") != "downloading":
            if status.get("status") == "finished":
                print(f"Finished downloading: {title}")
            return

        percent = status.get("_percent_str", "0.0%").strip()
        speed = status.get("_speed_str", "N/A").strip()
        eta = status.get("_eta_str")
        total_bytes = status.get("total_bytes") or status.get("total_bytes_estimate")
        downloaded_bytes = status.get("downloaded_bytes", 0)
        size = _format_bytes(total_bytes or downloaded_bytes)
        eta_display = eta if eta is not None else "N/A"
        line = (
            f"Downloading: {title}\n"
            f"Progress: {percent} | Speed: {speed} | ETA: {eta_display} | Size: {size}"
        )
        if line != last_line["value"]:
            print(line)
            last_line["value"] = line

    return hook


def _format_bytes(num_bytes: float | int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"

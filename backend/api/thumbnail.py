def extract_thumbnail(info_dict: dict) -> str | None:
    if not info_dict:
        return None
    thumb = info_dict.get("thumbnail")
    if isinstance(thumb, str) and thumb:
        return thumb
    thumbnails = info_dict.get("thumbnails")
    if isinstance(thumbnails, list) and thumbnails:
        valid_thumbs = [t for t in thumbnails if isinstance(t, dict) and t.get("url")]
        if valid_thumbs:
            try:
                sorted_thumbs = sorted(
                    valid_thumbs,
                    key=lambda x: int(x.get("width") or 0) * int(x.get("height") or 0),
                    reverse=True
                )
                return sorted_thumbs[0]["url"]
            except Exception:
                return valid_thumbs[-1]["url"]
    return None

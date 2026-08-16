from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import uvicorn


if __name__ == "__main__":
    # uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True) # Dev
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000) # Prod

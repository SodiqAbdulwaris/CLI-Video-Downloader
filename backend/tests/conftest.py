import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent

for path in (REPO_ROOT, BACKEND_ROOT, BACKEND_ROOT / "tests"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

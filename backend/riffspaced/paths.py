"""Filesystem anchors.

The backend reads schemas and fixtures from the repo-level `shared/` folder, which lives
outside the Python package. Resolving it relative to this file keeps every tool working
from any working directory. In Docker the folder is copied next to the package instead;
RIFFSPACED_SHARED_DIR overrides the location.
"""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
SHARED_DIR = Path(os.getenv("RIFFSPACED_SHARED_DIR", REPO_DIR / "shared"))
SCHEMA_DIR = SHARED_DIR / "schema"
FIXTURES_DIR = SHARED_DIR / "fixtures"

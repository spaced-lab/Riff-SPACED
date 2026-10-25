"""FastAPI application.

Phase 0 exposes only `GET /health`. Later phases add `/analyze` (audio in, riff JSON out),
`/ai/*` (Claude-backed musical reasoning), and `/tunings`.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from riffspaced import __version__

# A local `.env` (gitignored) may hold ANTHROPIC_API_KEY and friends. Environment variables
# already set win over the file, which is what you want in Docker and CI.
load_dotenv()

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:8080"


def cors_origins() -> list[str]:
    """Return the browser origins allowed to call this API.

    The frontend runs on 5173 in dev, 8080 in Docker, and on GitHub Pages in production.
    Extra origins come from RIFFSPACED_CORS_ORIGINS as a comma separated list.
    """
    raw = os.getenv("RIFFSPACED_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def create_app() -> FastAPI:
    """Build the FastAPI app. A factory keeps tests free to build fresh instances."""
    app = FastAPI(title="RIFF-SPACED backend", version=__version__)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, object]:
        """Liveness probe. The frontend polls this to show backend and AI availability."""
        return {
            "status": "ok",
            "version": __version__,
            "aiConfigured": bool(os.getenv("ANTHROPIC_API_KEY")),
        }

    return app


app = create_app()

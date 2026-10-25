"""FastAPI application (SPEC 8.4).

Routes:
- GET  /health            liveness, version, whether the AI key is configured
- GET  /tunings           the preset list
- POST /analyze           one audio file (multipart) plus options -> riff JSON and a report
- POST /analyze/batch     several files -> a list of results, one per file, failures included
- /ai/*                   Phase 7

Analysis runs in FastAPI's threadpool so the event loop stays responsive; uploads are
capped at 50 MB per file and decoded from a temporary file, since soundfile and ffmpeg want
a path.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from riffspaced import __version__
from riffspaced.analysis.io import FFMPEG_EXTENSIONS, SOUNDFILE_EXTENSIONS, UnsupportedFormat
from riffspaced.analysis.pipeline import AnalyzeOptions, analyze
from riffspaced.model.validate import ValidationError
from riffspaced.music.tuning import ALL_PRESETS

# A local `.env` (gitignored) may hold ANTHROPIC_API_KEY and friends. Environment variables
# already set win over the file, which is what you want in Docker and CI.
load_dotenv()

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:8080"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
SUPPORTED = sorted(SOUNDFILE_EXTENSIONS | FFMPEG_EXTENSIONS)


def cors_origins() -> list[str]:
    """Return the browser origins allowed to call this API.

    The frontend runs on 5173 in dev, 8080 in Docker, and on GitHub Pages in production.
    Extra origins come from RIFFSPACED_CORS_ORIGINS as a comma separated list.
    """
    raw = os.getenv("RIFFSPACED_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def parse_options(options_json: str | None, name: str | None) -> AnalyzeOptions:
    """Options arrive as a JSON string in the multipart form: tuning, bpm, maxFret, strings."""
    try:
        data: dict[str, Any] = json.loads(options_json) if options_json else {}
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=400, detail=f"options is not valid JSON: {error}"
        ) from error
    strings = data.get("strings")
    if isinstance(strings, list):
        strings = ",".join(str(s) for s in strings)
    try:
        return AnalyzeOptions.from_names(
            tuning_name=data.get("tuning"),
            bpm=float(data["bpm"]) if data.get("bpm") else None,
            max_fret=int(data.get("maxFret", 12)),
            strings=strings,
            name=name,
        )
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


async def analyze_upload(upload: UploadFile, options: AnalyzeOptions) -> dict[str, Any]:
    """Write the upload to a temp file, analyze it, and return `{ riff, report }`."""
    filename = upload.filename or "upload"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED:
        supported = ", ".join(SUPPORTED)
        detail = f"{filename}: unsupported type {suffix or '(none)'}; supported: {supported}"
        raise HTTPException(status_code=415, detail=detail)
    data = await upload.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{filename}: larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )
    if not data:
        raise HTTPException(status_code=400, detail=f"{filename}: empty upload")
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / Path(filename).name
        path.write_bytes(data)
        try:
            riff, report = await run_in_threadpool(analyze, path, options)
        except UnsupportedFormat as error:
            raise HTTPException(status_code=415, detail=str(error)) from error
        except ValidationError as error:
            raise HTTPException(
                status_code=500, detail=f"analysis produced an invalid riff: {error}"
            ) from error
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
    return {
        "riff": riff,
        "report": report.to_dict(),
        "reportMarkdown": report.to_markdown(Path(filename).stem),
    }


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

    @app.get("/tunings")
    def tunings() -> list[dict[str, object]]:
        """Every preset: name, pitches low to high, string count."""
        return [
            {"name": t.name, "pitches": list(t.pitches), "stringCount": t.string_count}
            for t in ALL_PRESETS
        ]

    @app.post("/analyze")
    async def analyze_one(
        file: UploadFile = File(...),  # noqa: B008 (FastAPI's dependency idiom)
        options: str | None = Form(default=None),
        name: str | None = Form(default=None),
    ) -> dict[str, Any]:
        """One recording in, one riff and report out."""
        return await analyze_upload(file, parse_options(options, name))

    @app.post("/analyze/batch")
    async def analyze_batch(
        files: list[UploadFile] = File(...),  # noqa: B008
        options: str | None = Form(default=None),
    ) -> dict[str, Any]:
        """Several recordings; each result carries `ok` and either the riff or an error."""
        parsed = parse_options(options, None)
        results: list[dict[str, Any]] = []
        for upload in files:
            try:
                result = await analyze_upload(upload, parsed)
                results.append({"ok": True, "file": upload.filename, **result})
            except HTTPException as error:
                results.append(
                    {
                        "ok": False,
                        "file": upload.filename,
                        "error": error.detail,
                        "status": error.status_code,
                    }
                )
        return {
            "results": results,
            "ok": sum(1 for r in results if r["ok"]),
            "failed": sum(1 for r in results if not r["ok"]),
        }

    return app


app = create_app()

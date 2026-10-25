"""FastAPI application (SPEC 8.4).

Routes:
- GET  /health            liveness, version, whether the AI key is configured
- GET  /tunings           the preset list
- POST /analyze           one audio file (multipart) plus options -> riff JSON and a report
- POST /analyze/batch     several files -> a list of results, one per file, failures included
- POST /ai/analyze        riff JSON -> dyad labels and a style reading (SPEC 9.2)
- POST /ai/suggest        { riff, kind, count, intent?, avoid? } -> suggested riffs (SPEC 9.2)
- POST /ai/cleanup        { riff, report? } -> corrected imported riff plus changes (SPEC 9.2)

AI routes answer 503 `{"reason": "ANTHROPIC_API_KEY not set"}` when no key and no fake client
is configured, 502 `{"reason": ...}` when the model's answer could not be used, and 400 when
the riff itself is invalid. The model call runs in the threadpool like the audio analysis.

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
from fastapi import Body, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from riffspaced import __version__
from riffspaced.ai.analyze import analyze_riff
from riffspaced.ai.cleanup import cleanup_riff
from riffspaced.ai.client import AiClient, AiError, AiNotConfiguredError, ai_configured, make_client
from riffspaced.ai.schemas import SUGGEST_KINDS
from riffspaced.ai.suggest import suggest
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


class SuggestRequest(BaseModel):
    """Body of POST /ai/suggest. `avoid` lists suggestions already shown (DECISIONS 55)."""

    riff: dict[str, Any]
    kind: str = Field(pattern="^(" + "|".join(SUGGEST_KINDS) + ")$")
    count: int = Field(default=2, ge=1, le=4)
    intent: str | None = Field(default=None, max_length=2000)
    avoid: list[str] = Field(default_factory=list, max_length=40)


class CleanupRequest(BaseModel):
    """Body of POST /ai/cleanup: an imported riff and, if available, its analysis report."""

    riff: dict[str, Any]
    report: dict[str, Any] = Field(default_factory=dict)


def ai_client_for(model_header: str | None) -> AiClient:
    """The AI client for one request.

    The frontend's AI settings dialog can send `X-Riffspaced-Model`; it is honored only when
    RIFFSPACED_ALLOW_MODEL_OVERRIDE=1, so a public deployment cannot be pointed at a model the
    owner did not choose to pay for.
    """
    allow = os.getenv("RIFFSPACED_ALLOW_MODEL_OVERRIDE", "") in {"1", "true", "yes"}
    return make_client(model=model_header if (allow and model_header) else None)


async def run_ai(operation: Any, *args: Any) -> Any:
    """Run an AI operation in the threadpool and map its failures to HTTP answers."""
    try:
        return await run_in_threadpool(operation, *args)
    except AiNotConfiguredError as error:
        return JSONResponse(status_code=503, content={"reason": error.reason})
    except AiError as error:
        return JSONResponse(status_code=502, content={"reason": str(error)})
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=f"invalid riff: {error}") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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
            "aiConfigured": ai_configured(),
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

    @app.post("/ai/analyze")
    async def ai_analyze(
        riff: dict[str, Any] = Body(...),  # noqa: B008
        x_riffspaced_model: str | None = Header(default=None),
    ) -> Any:
        """Dyad labels for every chord plus a style reading (SPEC 9.2)."""
        try:
            client = ai_client_for(x_riffspaced_model)
        except AiNotConfiguredError as error:
            return JSONResponse(status_code=503, content={"reason": error.reason})
        return await run_ai(analyze_riff, riff, client)

    @app.post("/ai/suggest")
    async def ai_suggest(
        body: SuggestRequest,
        x_riffspaced_model: str | None = Header(default=None),
    ) -> Any:
        """`count` suggested riffs of one `kind`, validated and repaired (SPEC 9.2)."""
        try:
            client = ai_client_for(x_riffspaced_model)
        except AiNotConfiguredError as error:
            return JSONResponse(status_code=503, content={"reason": error.reason})
        return await run_ai(
            suggest, body.riff, body.kind, body.count, client, body.intent, body.avoid
        )

    @app.post("/ai/cleanup")
    async def ai_cleanup(
        body: CleanupRequest,
        x_riffspaced_model: str | None = Header(default=None),
    ) -> Any:
        """Bounded repair of an imported riff; every accepted change is listed (SPEC 9.2)."""
        try:
            client = ai_client_for(x_riffspaced_model)
        except AiNotConfiguredError as error:
            return JSONResponse(status_code=503, content={"reason": error.reason})
        return await run_ai(cleanup_riff, body.riff, body.report, client)

    return app


app = create_app()

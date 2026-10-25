# RIFF-SPACED backend

Python 3.12 service with two jobs: turn recordings of low-tuned guitar riffs into riff JSON using the owner's own numpy/scipy analysis (Phase 6), and run the Claude-backed musical reasoning layer (Phase 7). The frontend works without it; this adds audio import and AI.

## Run

```
make install          # uv sync --extra dev (or pip install -e ".[dev]" without uv)
make dev              # uvicorn on http://localhost:8000, docs at /docs
make check            # ruff check, ruff format --check, pytest
curl localhost:8000/health
```

Configuration is read from the environment, with `.env` (gitignored) as a fallback. See `.env.example`.

## Layout

```
riffspaced/
  __init__.py     version
  api.py          FastAPI app and routes
  music/          Phase 1: pitch, tuning, time, dyad, fingering (mirrors frontend/src/music)
  model/          Phase 1: riff/arrangement/song dataclasses, schema validation, migration
  analysis/       Phase 6: io, preprocess, stft, onsets, tempo, fingering_match, decode, quantize, emit
  synth.py        Phase 6: Karplus-Strong plus waveshaper test-signal renderer
  ingest.py       Phase 6: folder-in, riff-JSON-out CLI
  ai/             Phase 7: prompts, client, analyze/suggest/cleanup
tests/            pytest, mirrors the package layout
tools/benchmark/  Phase 6: synthetic benchmark harness
audio_in/         drop your recordings here (gitignored)
riffs_out/        ingest output (gitignored)
debug/            debug plots when RIFFSPACED_DEBUG=1 (gitignored)
```

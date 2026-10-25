# Contributing

How to set up, how the gates work, how commits are written, where things live, and how to add the usual kinds of thing. The spec in `SPEC.md` is the source of truth; `DECISIONS.md` records every choice made along the way.

## Setup

```
git clone https://github.com/spaced-lab/Riff-SPACED
cd Riff-SPACED/frontend && npm install && npm run dev      # http://localhost:5173
cd ../backend && make install && make dev                  # http://localhost:8000
```

The backend pins Python 3.12 through `uv` (`backend/.python-version`); `make install` falls back to a venv and pip without uv. `ffmpeg` on the PATH lets the importer read mp3 and m4a. Copy `backend/.env.example` to `backend/.env` for a Claude API key; without one, `RIFFSPACED_AI_FAKE=1` runs the AI routes on the deterministic fake client, which is also what CI does.

## Gates

Every commit passes both gates before it is pushed.

```
cd frontend && npm run check     # eslint, prettier, tsc (app, node, e2e), vitest, vite build
cd frontend && npm run e2e       # Playwright against the dev server (reuses a running one)
cd backend && make check         # ruff check, ruff format --check, pytest
make check                       # both, from the repo root
```

The Playwright suite treats any console error as a failure (`e2e/helpers.ts`), writes the screenshots under `docs/screenshots/phase-NN/` that are committed as the visual record, and keeps two visual-regression baselines under `e2e/__screenshots__/` (skipped in CI; regenerate with `npx playwright test e2e/polish.spec.ts --update-snapshots`). Two opt-in specs talk to a real backend on port 8000: `RIFFSPACED_REAL_BACKEND=1 npx playwright test e2e/import-real.spec.ts e2e/ai-real.spec.ts`.

CI (`.github/workflows/ci.yml`) runs the frontend gate with e2e, the backend gate on the fake client, and builds both Docker images. Pages deploys the frontend from `main` on every push.

## Commit format

```
<type>(<scope>): <summary under 72 chars>

WHY: motivation in one or two sentences.
WHAT:
- concrete change
- concrete change
LEARN: a short paragraph a newcomer could learn from (the concept, the trap, the pattern).
TEST: how it was verified (unit, e2e, screenshot path, or "n/a: docs").
```

Types: `feat, fix, refactor, test, docs, chore, ci, perf`. Scopes: `music, fretboard, tab, audio, store, storage, export, backend, analysis, ai, ci, docs, plan` and the UI folders. One commit per task; push after every commit. No em dashes anywhere (code, comments, docs, UI text, commit messages).

## Where things live

```
frontend/src/
  music/      pure music rules (TypeScript, zero React): pitch, naming, tuning, time, dyad,
              fingering, transpose, tuningSearch. Mirrored in backend/riffspaced/music/.
  model/      document types, JSON schema validation, migration, factories, ids
  store/      one Zustand store built from slices; riffSlice.commit() is the only mutation
              door (undo, autosave and dirty tracking hang off it)
  audio/      scheduler, voices, master bus, offline render (zero React)
  export/     text tab, MIDI, WAV encoding, MusicXML
  storage/    file pickers and fallbacks, document parsing and merging, autosave
  api/        fetch wrappers for the backend (client.ts) and the AI routes (ai.ts)
  fretboard/ tab/ inspector/ library/ arrangement/ song/ menu/ transport/ import/ ai/ tuning/
              one component per file, CSS beside it, tests beside it
  hooks/      keyboard handling and small DOM hooks
frontend/e2e/ Playwright specs, helpers, menu helper
backend/riffspaced/
  music/ model/   the Python mirror of the two folders above
  analysis/       the import pipeline, one pure stage per module with a *_test.py
  ai/             prompts/, prompting, facts, schemas, client, fake_client, analyze, suggest, cleanup
  api.py ingest.py check_riffs.py synth.py
backend/tools/benchmark/   the synthetic benchmark (make bench)
shared/schema/   the JSON Schemas both sides validate against
shared/fixtures/ the cross-language fixture, the demo library, goldens, legacy documents
docs/            one document per subsystem, the learning log, the backlog, screenshots
plan/            the phase files the project was built from
```

Conventions: TypeScript strict, named exports, no `any` without a comment; every pure module has a sibling `*.test.ts`; UI components get at least one render test; Python has type hints everywhere, dataclasses for stage inputs and outputs, docstrings that explain the signal-processing idea in plain words; comments explain why, not what; never `alert`, `confirm` or `prompt` in the frontend (they block the browser automation used for testing).

## How to add things

**A tuning preset.** Add it to `STANDARD_PRESETS`, `DROP_PRESETS` or `SEVEN_STRING_PRESETS` in `frontend/src/music/tuning.ts` and the same tuple in `backend/riffspaced/music/tuning.py`, then add a case to the `tunings` section of `shared/fixtures/music-conventions.json` and bump the count in both parity tests (`frontend/src/music/parity.test.ts`, `backend/tests/test_fixture_parity.py`). The Tuning menu, the import dialog and the easier-tuning search read the preset lists.

**A technique.** Add the name to `TECHNIQUES` in `frontend/src/model/types.ts`, `backend/riffspaced/model/types.py` and the `technique` enum in `shared/schema/riff.schema.json`. Decide what it sounds like in `frontend/src/audio/voices/basic.ts` (and `heavy.ts` if it differs), what it looks like in `frontend/src/tab/TabNote.tsx` and `tab.css`, and how it exports in `export/musicxml.ts` and `export/midi.ts`. The inspector's technique toggles come from the list. Mention it in the prompts under `backend/riffspaced/ai/prompts/` if the model should know it.

**A voice.** Create `frontend/src/audio/voices/<name>.ts` exporting a `createXVoice(ctx, destination)` that returns the `Voice` interface in `voices/types.ts`, add the name to `VoiceName` in `store/transportSlice.ts`, construct it in `audio/engine.ts` and `audio/render.ts`, and add the Playback > Voice item in `menu/menuModel.ts` plus the option in the WAV export dialog. Test it against the fake Web Audio context in `voices/voices.test.ts`.

**An export.** Put a pure writer in `frontend/src/export/` (a riff in, a string or Blob out) with a golden file under `shared/fixtures/golden/` and a test that reads it with a `?raw` import. Add a `fileSlice` action that calls `saveFile` from `storage/files.ts` with the right name, a File > Export menu item, and a download check in `e2e/export.spec.ts`. Describe the mapping in `docs/FILE_FORMATS.md`.

**A pipeline stage.** Add a module under `backend/riffspaced/analysis/` with a pure function, a dataclass for its output and a `test_<stage>.py`, call it from `analysis/pipeline.py` inside a `stage(...)` timing block, and explain the idea in `docs/ANALYSIS_METHOD.md`. Run `make bench` and commit the new `docs/benchmarks/latest.md`; if the numbers move, say why in the commit.

**An AI operation.** Add a prompt file under `backend/riffspaced/ai/prompts/` with a `promptVersion` header, a response schema in `ai/schemas.py`, an operation module that builds the request from `facts.py`, calls `client.complete_json` with a check callback and post-processes the answer, a route in `api.py`, and a generated answer in `ai/fake_client.py` so the tests and the e2e suite run without a key. Then the frontend side: a call in `api/ai.ts`, an action in `store/aiSlice.ts`, a menu item.

## Owner variables

The repo is `spaced-lab/Riff-SPACED`, default branch `main`, Pages at https://spaced-lab.github.io/Riff-SPACED/. Secrets never enter git: `.env` files are ignored, the Claude key is read from `ANTHROPIC_API_KEY` only, and the owner's recordings under `injest-raw/` and `backend/audio_in/` are ignored and never deleted.

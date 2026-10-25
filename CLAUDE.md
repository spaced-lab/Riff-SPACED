# RIFF-SPACED: Claude Code project instructions

You are building RIFF-SPACED, a browser-based guitar riff-writing and transposing app with a Python audio-analysis backend and an AI layer. Read `SPEC.md` first, then `DECISIONS.md`, then the current phase file in `plan/`. `STATUS.md` says where you left off.

## Owner variables (edit before the first run)

- `GITHUB_OWNER`: `spaced-lab` (the org; commits and gh auth use the RidleyDiSiena account)
- `REPO_NAME`: `Riff-SPACED`
- `DEFAULT_BRANCH`: `main`
- `OWNER_NAME`: Ridley (handle SPACED)

## How to work

1. Work phase by phase, task by task, in the order given in `plan/phase-NN-*.md`. Do not skip ahead. Do not start a phase until the previous phase's exit gate passed.
2. Before each task, re-read the task's acceptance criteria. After each task: run the quality gates, commit with the message format below, push, and update `STATUS.md`.
3. Decisions are pre-made in `DECISIONS.md`. If you hit a real fork that is not covered, pick the simplest option consistent with `SPEC.md`, record it in `DECISIONS.md` under "Made during the run" with a one-line rationale, and keep going. Do not stop to ask unless a HARD STOP condition below applies.
4. Pause only at HARD STOP items. Everything else is automatic.
5. Keep code simple, modern, modular, professional, and well commented. A newcomer should be able to read any file top to bottom and learn from it. Prefer a few hundred lines of clear code over a dependency.
6. Never use `alert`, `confirm`, or `prompt` in the frontend. They block the Chrome extension used for testing.
7. Never commit secrets. `.env` files are gitignored. The Claude API key is read from `ANTHROPIC_API_KEY` only.
8. Never force-push. Never rewrite history on `main`. Never delete the owner's audio files.
9. Do not write em dashes anywhere (code comments, docs, commit messages, UI text). Use a comma, colon, period, or hyphen instead.

## HARD STOP conditions (ask the owner, then wait)

- Phase 7 needs `ANTHROPIC_API_KEY` and it is not set.
- Phase 6 real-recording tests need files in `backend/audio_in/` and the folder is empty (the synthetic benchmark still runs; only the real-audio task waits).
- A GitHub operation fails for auth reasons after one retry.
- Any step would delete or overwrite user data outside the repo.
- A dependency installation fails twice with different approaches.

When stopping, write the question and current state into `STATUS.md` under "Waiting on owner", commit, push, and say in chat exactly what is needed.

## Commands

Frontend (run from `frontend/`):
- `npm install`, `npm run dev` (http://localhost:5173), `npm run build`, `npm run preview`
- `npm run lint`, `npm run typecheck`, `npm run test` (Vitest), `npm run e2e` (Playwright, headless)
- `npm run check` runs lint, typecheck, test, and build in sequence. This is the frontend gate.

Backend (run from `backend/`):
- `uv sync` or `pip install -e ".[dev]"`, `uvicorn riffspaced.api:app --reload --port 8000`
- `ruff check .`, `ruff format --check .`, `pytest`
- `make check` runs all three. This is the backend gate.
- `python -m riffspaced.ingest ./audio_in --out ./riffs_out`
- `python -m tools.benchmark.run` writes `docs/benchmarks/latest.md`

Both: `docker compose up --build` serves frontend on 8080 and backend on 8000.

## Commit message format (every commit)

```
<type>(<scope>): <summary under 72 chars>

WHY: motivation in one or two sentences.
WHAT:
- concrete change
- concrete change
LEARN: a short paragraph a newcomer could learn from (the concept, the trap, the pattern). Omit only for pure chores.
TEST: how it was verified (unit, e2e, screenshot path, or "n/a: docs").
```

Types: feat, fix, refactor, test, docs, chore, ci, perf. Scopes: music, fretboard, tab, audio, store, storage, export, backend, analysis, ai, ci, docs, plan.

Commit after every task. Push after every commit. Tag `v0.<phase>.0` (annotated) at each phase exit gate.

## Verification in the browser

Two layers, both required for every UI task:

1. **Playwright** (`npm run e2e`): deterministic checks, screenshots to `docs/screenshots/phase-NN/<task>.png`, committed.
2. **Claude in Chrome**: after the Playwright run, open `http://localhost:5173` in a new tab with the Chrome tools, follow the phase file's "Chrome verification script", take screenshots, read the console (any error fails the task), and record what you saw in the commit's TEST line. Keep the dev server running in the background during the phase. If the Chrome tools are not available in this session, say so once in `STATUS.md` and rely on Playwright; do not block on it.

## Code conventions

- TypeScript strict, no `any` without a comment explaining why. Named exports. One component per file. Hooks in `hooks/`, pure logic in `music/`, `audio/`, `export/`, `storage/` with zero React imports.
- Every pure module has a sibling `*.test.ts`. UI components get at least one render test.
- Python: type hints everywhere, dataclasses for stage inputs/outputs, docstrings that explain the signal-processing idea in plain English, `ruff` clean. Each pipeline stage is a pure function in its own module with a `*_test.py`.
- Comments explain why, not what. Where a formula or algorithm appears, cite the idea by name (for example "lookahead scheduler, see docs/AUDIO_ENGINE.md").
- No em dashes.

## Learning artifacts (keep current)

- `STATUS.md`: rewritten at every checkpoint (phase, last task, next task, how to run, waiting-on-owner).
- `docs/LEARNING_LOG.md`: one entry per phase with the most instructive commit hashes.
- `docs/BACKLOG.md`: anything deferred, with the reason.
- `DECISIONS.md`: append-only "Made during the run" section.

## Context management

Long run. After each phase exit gate, run `/compact` with the focus "RIFF-SPACED: current phase, STATUS.md contents, open issues". If the session is resumed, read `STATUS.md` before anything else.

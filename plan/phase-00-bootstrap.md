# Phase 0: Bootstrap

Goal: an empty folder becomes a public GitHub repo with a runnable frontend skeleton, a runnable backend skeleton, CI, GitHub Pages deploy, and the documentation scaffolding. Nothing musical yet. Everything after this phase is commit-push-verify on top of a working base.

Read first: CLAUDE.md (owner variables), DECISIONS.md items 11 to 20 and 30 to 35.

## P0.T1 Preflight and repo init

Steps:
1. Run and record into `STATUS.md` (create it from the PLAN.md template): `claude --version`, `node --version`, `npm --version`, `python3 --version`, `gh --version`, `gh auth status`, `git --version`, `docker --version || echo "docker not installed"`, `which uv ffmpeg || true`. Also record whether the Claude in Chrome tools are present in this session (try listing tabs once).
2. `git init -b main`.
3. Create `.gitignore` covering: `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `*.pyc`, `.env`, `.env.*`, `backend/audio_in/*` (keep a `.gitkeep`), `backend/riffs_out/`, `backend/debug/`, `frontend/playwright-report/`, `frontend/test-results/`, `.DS_Store`, `.claude/settings.local.json`.
4. Create `README.md` (short for now: name, one-paragraph description from SPEC section 1, "built in public with Claude Code, every commit is a lesson", link to STATUS.md and docs/). Create `LICENSE` (MIT, owner name from CLAUDE.md, year 2026).
5. Create `docs/LEARNING_LOG.md` (heading and a sentence on how to read it), `docs/BACKLOG.md` (copy SPEC section 12 as the initial list), `docs/screenshots/.gitkeep`, `docs/benchmarks/.gitkeep`.
6. Create `.claude/settings.json` from the JSON block in README-START-HERE.md if the owner has not already created it. Commit it; it is meant to be shared.
7. First commit: `chore(repo): initialize RIFF-SPACED repository with plan, docs scaffolding, and ignores`.
8. Create the GitHub repo and push: `gh repo create <GITHUB_OWNER>/<REPO_NAME> --public --source=. --remote=origin --push --description "Browser-based guitar riff writing and transposing tool for low-tuned heavy music, with Python audio analysis and an AI layer. Built in public with Claude Code."`. If `gh repo create` fails for auth, retry once after `gh auth status`; if it still fails, HARD STOP.
9. `gh repo edit --enable-issues --enable-wiki=false`, add topics: `guitar, music, tablature, web-audio, react, typescript, fastapi, audio-analysis, claude-code`.

Acceptance:
- `git remote -v` shows origin on GitHub; `gh repo view --web` would open it (do not open it).
- `STATUS.md` preflight filled in.

## P0.T2 Frontend skeleton

Steps:
1. `npm create vite@latest frontend -- --template react-ts` (non-interactive; if the scaffolder prompts, pass the flags it needs or create the files by hand following Vite's react-ts template).
2. In `frontend/`: install dev deps `vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test eslint prettier eslint-config-prettier typescript-eslint @types/node`. Install runtime dep `zustand`.
3. `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, path alias `@/` to `src/`.
4. Scripts in `package.json`: `dev`, `build`, `preview`, `lint` (eslint src), `format` (prettier write), `format:check`, `typecheck` (tsc --noEmit), `test` (vitest run), `test:watch`, `e2e` (playwright test), `check` (`npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build`).
5. Vite config: `base` set from env `VITE_BASE_PATH` defaulting to `/` so GitHub Pages can set `/riff-spaced/`. Vitest config with `environment: jsdom`, setup file importing jest-dom.
6. Playwright config: `webServer` runs `npm run dev` on 5173 with `reuseExistingServer: true`, Chromium only, `screenshot: 'only-on-failure'` globally; tests will call `page.screenshot` explicitly for the docs. Output folder `test-results/`.
7. Replace the Vite demo app with `src/App.tsx` rendering a black page with a green monospace heading `RIFF-SPACED` and the text `phase 0: bootstrap`. Create `src/theme.css` with the custom properties from SPEC 5.1 and import it in `main.tsx`. Set `<title>RIFF-SPACED</title>` and a green square favicon SVG.
8. Tests: `src/App.test.tsx` asserts the heading renders. `e2e/smoke.spec.ts` opens `/`, asserts the heading, checks there are no console errors (attach a `page.on('console')` listener and a `page.on('pageerror')` listener and fail on either), screenshots to `../docs/screenshots/phase-00/smoke.png`.
9. `npx playwright install chromium` (local only; CI installs with deps).
10. `npm run check` and `npm run e2e` green.

Chrome verification script:
- Open a new tab at http://localhost:5173. Screenshot. Expect: black background, green `RIFF-SPACED`. Read console: no errors.

Commit: `feat(frontend): scaffold React + TypeScript + Vite app with theme, Vitest, Playwright, and check script`.

## P0.T3 Backend skeleton

Steps:
1. `backend/pyproject.toml`: project `riffspaced`, Python `>=3.12`, deps `fastapi uvicorn[standard] numpy scipy soundfile jsonschema anthropic python-dotenv`, dev deps `pytest pytest-cov ruff httpx matplotlib`. Ruff config: line length 100, select `E F I B UP N D` with `D` relaxed to require docstrings only on public functions.
2. `backend/riffspaced/__init__.py` with `__version__ = "0.0.0"`. `backend/riffspaced/api.py`: FastAPI app, CORS allowing `http://localhost:5173` and `http://localhost:8080` and the Pages origin (from env `RIFFSPACED_CORS_ORIGINS`, comma separated), `GET /health` returning `{ "status": "ok", "version": __version__, "aiConfigured": bool(os.getenv("ANTHROPIC_API_KEY")) }`.
3. `backend/tests/test_health.py` using `httpx` and FastAPI's TestClient.
4. `backend/Makefile`: `install` (uv sync if uv exists else pip install -e ".[dev]"), `dev` (uvicorn reload on 8000), `lint` (ruff check . && ruff format --check .), `test` (pytest -q), `check` (lint then test).
5. `backend/.env.example` with `ANTHROPIC_API_KEY=`, `RIFFSPACED_MODEL=claude-sonnet-5-5`, `RIFFSPACED_CORS_ORIGINS=http://localhost:5173`, `RIFFSPACED_DEBUG=0`.
6. `backend/audio_in/.gitkeep`, `backend/README.md` (how to run, folder layout).
7. `make install && make check` green. Start the server once, `curl localhost:8000/health`, stop it.

Commit: `feat(backend): scaffold FastAPI service with health endpoint, ruff, pytest, and Makefile`.

## P0.T4 Shared schemas folder and fixtures placeholder

Steps:
1. `shared/schema/README.md` explaining that both frontend and backend validate against these files and that Phase 1 fills them in.
2. `shared/fixtures/README.md` explaining `music-conventions.json` and `demo-library.json` (Phase 1 fills them).
3. Frontend Vite config: add `shared/` as an allowed FS path and a `@shared/` alias so fixtures can be imported in tests. Backend: `riffspaced/paths.py` with `SHARED_DIR` resolved relative to the repo root.

Commit: `chore(shared): add shared schema and fixtures folders wired into both sides`.

## P0.T5 CI and GitHub Pages

Steps:
1. `.github/workflows/ci.yml`: on push and pull_request to main. Jobs: `frontend` (ubuntu, node 20, `npm ci`, `npm run check`, `npx playwright install --with-deps chromium`, `npm run e2e`, upload `docs/screenshots` and `playwright-report` as artifacts on failure), `backend` (python 3.12, `pip install -e ".[dev]"`, `make check`).
2. `.github/workflows/pages.yml`: on push to main after CI, build frontend with `VITE_BASE_PATH=/<REPO_NAME>/`, deploy with `actions/upload-pages-artifact` and `actions/deploy-pages`. Enable Pages via `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow` (ignore 409 if already enabled).
3. Push, then `gh run watch` until both workflows finish. Fix anything red before moving on. Record the Pages URL in README.md and STATUS.md.

Commit: `ci: add CI for frontend and backend gates plus GitHub Pages deploy of the frontend`.

## P0.T6 Docker (minimal)

Steps:
1. `frontend/Dockerfile`: multi-stage, node build then `nginx:alpine` serving `dist/` on 80 with a `try_files` SPA fallback.
2. `backend/Dockerfile`: `python:3.12-slim`, install, `uvicorn riffspaced.api:app --host 0.0.0.0 --port 8000`.
3. `docker-compose.yml`: frontend on 8080, backend on 8000, env from `backend/.env` if present.
4. If Docker is installed, `docker compose build` must succeed; if not installed, note it in STATUS.md and move on (this is not a HARD STOP).

Commit: `chore(docker): add container builds for frontend and backend with compose`.

## P0.T7 Phase exit

1. `docs/LEARNING_LOG.md` entry: "Phase 0: what a healthy repo skeleton looks like" with commit hashes for T2, T3, T5 and a paragraph on why gates come before features.
2. `STATUS.md` rewritten: Phase 0 complete, next P1.T1.
3. `git tag -a v0.0.0 -m "Phase 0: bootstrap complete"` and `git push --tags`.
4. `/compact` focus "RIFF-SPACED: starting Phase 1 music core; STATUS.md; preflight results".

Exit gate: CI green on GitHub, Pages URL serving the placeholder page, tag pushed.

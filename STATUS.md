# STATUS

Updated: 2026-10-25T01:40:40Z
Phase: 2 Fretboard
Last completed task: P2.T3 Fretboard component
Next task: P2.T4 Tuning menu and view toggles (temporary toolbar)

## Preflight
claude: 2.1.310 | node: v26.0.0 | npm: 11.12.1 | python3: 3.14.7 (backend pins 3.12 via uv) | uv: 0.12.5 | gh: 2.92.0, logged in as RidleyDiSiena, https | git: 2.54.0 | docker: 29.4.1 (daemon running) | ffmpeg: 9.0.1 | chrome tools: available (console reads work, screenshot injection times out on the dev page, see Known issues)

## Links
- Repo: https://github.com/spaced-lab/Riff-SPACED
- Pages (frontend): https://spaced-lab.github.io/Riff-SPACED/
- CI: https://github.com/spaced-lab/Riff-SPACED/actions

## Phase checklist
Phase 0 (tag v0.0.0):
- [x] P0.T1 Preflight and repo init
- [x] P0.T2 Frontend skeleton
- [x] P0.T3 Backend skeleton
- [x] P0.T4 Shared schemas folder and fixtures placeholder
- [x] P0.T5 CI and GitHub Pages
- [x] P0.T6 Docker (minimal)
- [x] P0.T7 Phase exit

Phase 1 (tag v0.1.0):
- [x] P1.T1 Shared conventions fixture
- [x] P1.T2 TypeScript music module
- [x] P1.T3 Document types, schemas, validation, migration (TypeScript)
- [x] P1.T4 Demo library fixture
- [x] P1.T5 Python mirror of the music module and schemas
- [x] P1.T6 Docs and phase exit

Phase 2:
- [x] P2.T1 Store foundation
- [x] P2.T2 Fretboard geometry
- [x] P2.T3 Fretboard component
- [ ] P2.T4 Tuning menu and view toggles (temporary toolbar)
- [ ] P2.T5 App shell and dev harness route
- [ ] P2.T6 Phase exit

## How to run right now
```
cd frontend && npm install && npm run dev   # http://localhost:5173
npm run check                              # lint, format, typecheck, unit tests, build
npm run e2e                                # Playwright smoke test

cd backend && make install && make dev     # http://localhost:8000/health, /docs
make check                                 # ruff, pytest

docker compose up --build                  # frontend :8080, backend :8000
```

## Known issues
- Claude in Chrome: console reading works (clean), but script injection for screenshots and page reads times out on the Vite dev page in this session ("Page still loading"). Playwright is the gate and produces the committed screenshots; the Chrome pass is retried each UI phase.

## Waiting on owner
(none)

Heads-up for later: Phase 7 needs ANTHROPIC_API_KEY in the shell or in backend/.env (gitignored). Phase 6's real-recording task will skip and continue if backend/audio_in/ is empty (DECISIONS 39).

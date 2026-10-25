# STATUS

Updated: 2026-10-25T01:08:51Z
Phase: 0 Bootstrap
Last completed task: P0.T5 CI and GitHub Pages
Next task: P0.T6 Docker (minimal)

## Preflight
claude: 2.1.310 | node: v26.0.0 | npm: 11.12.1 | python3: 3.14.7 (backend pins 3.12 via uv) | uv: 0.12.5 | gh: 2.92.0, logged in as RidleyDiSiena, https | git: 2.54.0 | docker: 29.4.1 (daemon running) | ffmpeg: 9.0.1 | chrome tools: available

## Phase checklist
- [x] P0.T1 Preflight and repo init
- [x] P0.T2 Frontend skeleton
- [x] P0.T3 Backend skeleton
- [x] P0.T4 Shared schemas folder and fixtures placeholder
- [x] P0.T5 CI and GitHub Pages
- [ ] P0.T6 Docker (minimal)
- [ ] P0.T7 Phase exit

## Links
- Repo: https://github.com/spaced-lab/Riff-SPACED
- Pages (frontend): https://spaced-lab.github.io/Riff-SPACED/

## How to run right now
```
cd frontend && npm install && npm run dev   # http://localhost:5173
npm run check                              # lint, format, typecheck, unit tests, build
npm run e2e                                # Playwright smoke test

cd backend && make install && make dev     # http://localhost:8000/health, /docs
make check                                 # ruff, pytest
```

## Known issues
- Claude in Chrome: console reading works (clean), but script injection for screenshots and page reads times out on the Vite dev page in this session ("Page still loading"). Playwright is the gate and produces the committed screenshots; the Chrome pass is retried each UI phase.

## Waiting on owner
(none)

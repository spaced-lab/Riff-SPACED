# STATUS

Updated: 2026-10-25T03:56:45Z
Phase: 6 Analysis backend (complete), Phase 7 AI layer blocked on the API key
Last completed task: P6.T11 Chrome verification and phase exit
Next task: P7.T1 Prompt files and client wrapper (HARD STOP: ANTHROPIC_API_KEY is not set, see Waiting on owner)

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

Phase 2 (tag v0.2.0):
- [x] P2.T1 Store foundation
- [x] P2.T2 Fretboard geometry
- [x] P2.T3 Fretboard component
- [x] P2.T4 Tuning menu and view toggles (temporary toolbar)
- [x] P2.T5 App shell and dev harness route
- [x] P2.T6 Phase exit

Phase 3 (tag v0.3.0):
- [x] P3.T1 Tab lane geometry and rendering
- [x] P3.T2 Note entry from the fretboard and keyboard
- [x] P3.T3 Selection, drag, resize, clipboard
- [x] P3.T4 Sections, loop length, grid, quantize
- [x] P3.T5 Undo/redo and autosave
- [x] P3.T6 Inspector for notes and dyads
- [x] P3.T7 e2e, Chrome verification, phase exit

Phase 4 (tag v0.4.0):
- [x] P4.T1 Audio engine core (no React)
- [x] P4.T2 Voices
- [x] P4.T3 Transport and store integration
- [x] P4.T4 Visual sync: fretboard flash and playhead
- [x] P4.T5 Four-way split view
- [x] P4.T6 Offline render and non-silence test
- [x] P4.T7 Chrome verification and phase exit

Phase 5 (tag v0.5.0):
- [x] P5.T1 Menu bar and dialogs
- [x] P5.T2 Library store and panel
- [x] P5.T3 Arrangement and song editors
- [x] P5.T4 File open and save
- [x] P5.T5 Text tab export
- [x] P5.T6 MIDI export
- [x] P5.T7 e2e, Chrome verification, phase exit

Phase 6 (tag v0.6.0):
- [x] Preflight: re-check the Messages API for an audio content block (none; DECISIONS 49)
- [x] P6.T1 Audio I/O and preprocessing
- [x] P6.T2 Test-signal synth (ground truth generator)
- [x] P6.T3 STFT and onset detection
- [x] P6.T4 Tempo estimation
- [x] P6.T5 Fingering-constrained spectral template matching
- [x] P6.T6 Viterbi decode, quantize, emit
- [x] P6.T7 Benchmark harness
- [x] P6.T8 Ingest CLI and API endpoints
- [x] P6.T9 Frontend import flow
- [x] P6.T10 Real recordings (skip and continue if backend/audio_in is empty, DECISIONS 39)
- [x] P6.T11 Chrome verification and phase exit

Phase 7:
- [ ] HARD STOP check: ANTHROPIC_API_KEY (not set as of this commit)
- [ ] P7.T1 Prompt files and client wrapper
- [ ] P7.T2 Analyze endpoint
- [ ] P7.T3 Suggest endpoint
- [ ] P7.T4 Cleanup endpoint and ingest --ai
- [ ] P7.T5 Live smoke test (needs the key)
- [ ] P7.T6 Frontend: AI menu and suggestions drawer
- [ ] P7.T7 Chrome verification and phase exit

## How to run right now
```
cd frontend && npm install && npm run dev   # http://localhost:5173
npm run check                              # lint, format, typecheck, unit tests, build
npm run e2e                                # Playwright: 12 specs; RIFFSPACED_REAL_BACKEND=1 npx playwright test e2e/import-real.spec.ts runs the real-backend import (backend on :8000)
# dev harness: http://localhost:5173/#/dev/fretboard

cd backend && make install && make dev     # http://localhost:8000/health, /docs
make check                                 # ruff, pytest
make bench                                 # synthetic benchmark, writes docs/benchmarks/latest.md
uv run python -m riffspaced.ingest audio_in --out riffs_out --tuning "Bb Standard"   # folder in, riff JSON out
uv run python -m riffspaced.synth ../shared/fixtures/demo-library.json --riff "Walkdown Turnaround" --out debug/walkdown.wav --drive 8

docker compose up --build                  # frontend :8080, backend :8000
```

## Known issues
- Commit a90199a has a red CI run (one unit test); fixed in f3846f8, CI green since. Cause: a shell pipeline masked the gate's exit code. Gates now run with explicit exit codes.
- Claude in Chrome: console reading works (clean), but script injection for screenshots and page reads times out on the Vite dev page in this session ("Page still loading"). Playwright is the gate and produces the committed screenshots; the Chrome pass is retried each UI phase.

## Waiting on owner

**Phase 7 needs an Anthropic API key and none is available.** `ANTHROPIC_API_KEY` is not set in the shell that runs Claude Code and `backend/.env` does not exist (checked at this commit; the key's value is never read or printed by the run). The AI layer calls the Claude API from the Python backend, which is billed to that key separately from the Claude Code login.

To continue, either:

1. `export ANTHROPIC_API_KEY=sk-ant-...` in the shell, then tell the run: "The key is set in the environment. Continue Phase 7."
2. or create `backend/.env` (gitignored) with the line `ANTHROPIC_API_KEY=sk-ant-...` (copy `backend/.env.example`), then say the same.

If you want the AI layer built without a key for now, say "Build Phase 7 with the fake client, skip the live smoke test": P7.T1 to T4 and T6 run on the deterministic fake client and only P7.T5 (the live smoke test and the worked example in docs/AI_LAYER.md) waits for the key.

Also still open, not blocking: drop recordings into `backend/audio_in/` whenever you like (recipe in docs/BACKLOG.md).

Heads-up: Phase 7 needs ANTHROPIC_API_KEY in the shell or in backend/.env (gitignored); the run will stop at Phase 7 if it is missing. Real recordings: drop WAV or FLAC files into backend/audio_in/ any time and run the ingest recipe in docs/BACKLOG.md.

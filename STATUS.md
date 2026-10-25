# STATUS

Updated: 2026-10-25T23:30:00Z
Phase: 9 (scale mode and CAGED positions, owner request after v1), all tasks done, tag v0.9.0.
Last completed task: P9.T6 wide fretboard and neck option (owner correction of the full-screen attempt)
Next task: none scheduled; owner feedback on the scale colors and the position shapes (see Owner follow-ups)

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

Phase 7 (tag v0.7.0):
- [x] HARD STOP check: ANTHROPIC_API_KEY (not set; owner chose the fake client, DECISIONS 54)
- [x] P7.T1 Prompt files and client wrapper
- [x] P7.T2 Analyze endpoint
- [x] P7.T3 Suggest endpoint
- [x] P7.T4 Cleanup endpoint and ingest --ai
- [x] P7.T5 Live smoke test (written, skipped until RIFFSPACED_LIVE=1 and a key; see Waiting on owner)
- [x] P7.T6 Frontend: AI menu and suggestions drawer
- [x] P7.T7 Chrome verification and phase exit (Chrome tools could not inject into the page; verified with e2e/ai-real.spec.ts against the fake backend, see Known issues)

Phase 8 (tag v0.8.0):
- [x] P8.T1 Transpose and retune tools
- [x] P8.T2 Find easier tuning
- [x] P8.T3 MusicXML export
- [x] P8.T4 WAV export and heavy voice (heavy voice shipped in Phase 4, DECISIONS 48)
- [x] P8.T5 CRT toggle and visual polish
- [x] P8.T6 Containers and compose, final
- [x] P8.T7 Public docs
- [x] P8.T8 Final verification and exit (fresh clone: both gates and 23 e2e specs green; Pages checked with pages.spec.ts; tag v0.8.0)

Phase 9 (tag v0.9.0, plan/phase-09-scales.md):
- [x] P9.T1 Scale definitions (music/scales.ts)
- [x] P9.T2 Store slice and persisted preferences
- [x] P9.T3 Overlay, legend, Scales menu
- [x] P9.T5 CAGED positions (music/positions.ts, Position submenu, < and > shortcuts)
- [x] P9.T4 Docs and exit (FRETBOARD.md, USER_GUIDE.md 6a, LEARNING_LOG, DECISIONS 60-62)
- [x] P9.T6 Follow the position (fret range slides, clamped 0..24), wide fretboard (F, side panels hidden), neck option (follow / all 24)

## How to run right now
```
cd frontend && npm install && npm run dev   # http://localhost:5173
npm run check                              # lint, format, typecheck, unit tests, build
npm run e2e                                # Playwright: 12 specs; RIFFSPACED_REAL_BACKEND=1 npx playwright test e2e/import-real.spec.ts runs the real-backend import (backend on :8000)
# dev harness: http://localhost:5173/#/dev/fretboard
# reset to the demo library: http://localhost:5173/?demo=1

cd backend && make install && make dev     # http://localhost:8000/health, /docs
RIFFSPACED_AI_FAKE=1 make dev              # same, with the AI routes answered by the deterministic fake (no key needed)
RIFFSPACED_REAL_BACKEND=1 npx playwright test e2e/ai-real.spec.ts   # (from frontend/) the AI flow against that backend
make check                                 # ruff, pytest
make bench                                 # synthetic benchmark, writes docs/benchmarks/latest.md
uv run python -m riffspaced.ingest audio_in --out riffs_out --tuning "Bb Standard"   # folder in, riff JSON out
uv run python -m riffspaced.synth ../shared/fixtures/demo-library.json --riff "Walkdown Turnaround" --out debug/walkdown.wav --drive 8
uv run python -m riffspaced.check_riffs ../injest-riff-JSON   # validate riff JSON made by outboard tools (guide: outboard-guidance/)

make up                                    # docker compose up --build -d: app on :8080 (nginx proxies /api to the backend), backend also on :8000
make down                                  # stop the containers; make check runs both gates
```

## Known issues
- Claude in Chrome cannot run scripts in the app page in this environment: screenshots, page reads and finds time out ("Script injection timed out", "Page still loading, waited 45000ms for document_idle") on both the Vite dev page (5173) and the production preview (8080); console reads work and were clean. Per CLAUDE.md the Playwright suites are the gate; Phase 7's Chrome script was run as `e2e/ai-real.spec.ts` against the backend with the fake client (analyze, 23 labels, variations, audition with sounding notes, add as variation, undo, three tunings; console clean), screenshots in docs/screenshots/phase-07/real-*.png. Step 5 of the script (menu disabled without a key) is covered by the mocked `e2e/ai.spec.ts` and `/health` reporting aiConfigured false without the fake.
- Commit b44c5b8 had a red frontend CI job: two e2e specs timed out in the menu helper on a submenu. Cause: a click on a submenu parent toggled, so when the hover render had already opened the submenu (slow runner) the click closed it; locally the click lands before that render. Fixed in the next commit: a parent click only opens.
- Commit 589a837 (Phase 6 close) had a red frontend CI job: with no backend in CI, Chromium logs the health poll's refused connection as a console error and the e2e suite counted it. Fixed in the next commit by ignoring resource errors from the optional backend's endpoints in the test helper; reproduced locally with the backend stopped before the fix went in.
- Commit a90199a has a red CI run (one unit test); fixed in f3846f8, CI green since. Cause: a shell pipeline masked the gate's exit code. Gates now run with explicit exit codes.
- Claude in Chrome: console reading works (clean), but script injection for screenshots and page reads times out on the Vite dev page in this session ("Page still loading"). Playwright is the gate and produces the committed screenshots; the Chrome pass is retried each UI phase.

## Resume instructions (owner decision 2026-10-25)

**Build Phase 7 with the fake client. Skip the live smoke test.** The owner chose this after the Phase 7 HARD STOP (no `ANTHROPIC_API_KEY` in the shell, no `backend/.env`). Recorded as DECISIONS 54. The next session starts P7.T1 directly and does not stop again for the key:

- P7.T1 to T4, T6, T7 run on `riffspaced/ai/fake_client.py`, selected by `RIFFSPACED_AI_FAKE=1`. CI sets that variable.
- P7.T5 (live smoke test) is written and marked skipped unless `RIFFSPACED_LIVE=1`; it is not run. Leave a "Waiting on owner" line for it in this file and in docs/AI_LAYER.md.
- Worked example for docs/AI_LAYER.md: a transcript pass. The backend writes the exact system and user messages for `/ai/analyze` on the demo walkdown to the scratchpad; the Claude Code session answers them as the model would; the answer goes through the same validator and repair step. Label it clearly as produced by Claude Code in-session, not by the API.
- When the owner later creates a key: `export ANTHROPIC_API_KEY=...` (or `backend/.env`), run `RIFFSPACED_LIVE=1 uv run pytest tests/live`, paste the result into docs/AI_LAYER.md. No code change.
- Then Phase 8 without a stop.

**Real recordings arrived.** Three files are in `injest-raw/` at the repo root (RS-Descent.m4a, RS-NM1.m4a, RS-Spider.m4a, 2.6 MB total, m4a so ffmpeg decode). That folder is gitignored as of this commit; the files are the owner's and are never deleted or committed. On resume, before or after Phase 7: copy (not move) them into `backend/audio_in/`, run the P6.T10 recipe from docs/BACKLOG.md (ingest each, compare with what the owner played if a tab exists, record findings in docs/ANALYSIS_METHOD.md and LEARNING_LOG), and ask the owner only if a recording's tuning is not Bb Standard.

**Real recordings: first pass done (P6.T10, 2026-10-25).** All three takes ran end to end; findings in `docs/benchmarks/real-audio-notes.md` and the postscript in `docs/ANALYSIS_METHOD.md`. The outputs are in `backend/riffs_out/` (gitignored).

## Resume after pause (2026-10-25, end of the Phase 9 session)

State: main at the commit after d0e4fb4 (wide board and neck option), tag v0.9.0 three commits behind it, CI green, working tree clean. Dev server on :5173 and the fake-client backend on :8000 were left running; if they are gone, start them with the commands under How to run right now. Repo is still private; the owner plans to make it public (Pages on a private repo needs a paid plan).

What Phase 9 added, for orientation: Scales menu (off / full color / mono, scale, root, color switches, position, neck), legend above the board (swatches toggle colors, position arrows, follow / all 24, wide), `<` `>` for positions, `F` for the wide board. Code: `frontend/src/music/scales.ts`, `positions.ts`, `store/scaleSlice.ts`, `fretboard/ScaleDots.tsx`, `ScaleLegend.tsx`. Colors: the `--scale-*` block in `frontend/src/theme.css`.

On resume:
1. Read Owner follow-ups. The owner was going to try the scale colors and the CAGED shapes and say what to change; a color change is a token edit in theme.css, a shape change is in `positions.ts` (DECISIONS 62 explains the derivation).
2. Possible next steps the owner mentioned or that fell out of the work: a faint band marking the position's fret span, a 3-notes-per-string position system beside CAGED, Tab-key traversal (BACKLOG, Phase 8 note), the real-recording items in BACKLOG.
3. Otherwise take the next item from docs/BACKLOG.md.

## Resume after clear (2026-10-25, end of the autonomous run)

State: main is at 0288a9a, tag v0.8.0 is three commits behind it (docs and the submenu fix), CI green, working tree clean. Nothing is waiting on code. On `resume`:

1. Read Owner follow-ups below. If a new recording is in `injest-raw/`, copy it into `backend/audio_in/`, run `uv run python -m riffspaced.ingest audio_in --out riffs_out --ai --tuning "<tuning the owner stated>"` with `RIFFSPACED_AI_FAKE=1`, read the `.riff.yaml`, and score it against the owner's tab (notes hit, notes missed, extra notes, per bar). Then tune the analysis knobs in this order: bar alignment with the known riff length, relative palm-mute threshold, onset flux threshold. Record every number in `docs/benchmarks/real-audio-notes.md` (third pass).
2. If files are in `injest-riff-JSON/`, run `uv run python -m riffspaced.check_riffs ../injest-riff-JSON`, open the valid ones with File > Open, and compare with the built-in analyzer's output for the same recording in `docs/ANALYSIS_METHOD.md`.
3. If `ANTHROPIC_API_KEY` exists, run the live smoke test (recipe in docs/AI_LAYER.md) and paste the result there.
4. Otherwise take the next item from docs/BACKLOG.md in its listed order.

Background processes left running for the owner at the end of the run: uvicorn with `RIFFSPACED_AI_FAKE=1` on :8000 and the Vite dev server on :5173. If they are gone, start them with the commands under How to run right now.

## Owner follow-ups

- Scale mode (Phase 9): try Scales > Full color with Blues and a few roots, the wide board (`F`) and the all-24 neck, and say which colors to change. The palette is the `--scale-*` block at the top of `frontend/src/theme.css`; every degree has one token. Also check the CAGED shapes against how you learned them (Scales > Position, or `<` and `>`): the derivation is in `frontend/src/music/positions.ts` and DECISIONS 62. Ideas not built yet: show the position's fret span as a faint band, a 3-notes-per-string position system, letters inside scale dots when the neck is tall enough.

- Open a MusicXML export in MuseScore or Guitar Pro once and report (P8.T3).
- Record one riff you can write down (four bars, looped three or four times, played the way you play), ideally captured from the interface or amp output rather than the phone, and say which tuning. Drop it in `injest-raw/`. That is what the analyzer needs next; the three takes there now show no repeat structure the pipeline can lock onto.
- Create an `ANTHROPIC_API_KEY` when ready and run the live smoke test (recipe in docs/AI_LAYER.md).
- Consider the backlog order in docs/BACKLOG.md; the real-recording pass is first by your request.

## After Phase 8 (owner request 2026-10-25)

Done, first round: the three recordings went through the analysis and the fake-client cleanup, and the results are in `backend/riffs_out/*.riff.yaml` and `*.clean.riff.yaml` (gitignored). The notes cannot yet be picked out with confidence; the measurements and the reasons are in `docs/benchmarks/real-audio-notes.md` (second pass). Tuning stopped there on purpose: without one known riff there is nothing to score against.

## Waiting on owner (not blocking)

- Open a MusicXML export (File > Export > MusicXML, or `shared/fixtures/golden/walkdown.musicxml`) in MuseScore or Guitar Pro once and report what the tab looks like (P8.T3 owner task).
- The live AI smoke test (P7.T5) has not run: no `ANTHROPIC_API_KEY`. When one exists: `export ANTHROPIC_API_KEY=...` (or `backend/.env`), then `cd backend && RIFFSPACED_LIVE=1 uv run pytest tests/live -q -s`, and paste the printed summary and usage into docs/AI_LAYER.md. No code change.
- For the three recordings in `injest-raw/`: were they played in Bb Standard? If not, which tuning? And for at least one of them, a tab or a description of the riff (frets or note names), so the analyzer's output can be scored. The low end of all three files peaks around F2, G2 and Eb2 and almost never at the open Bb1, which is either the rig's resonance or a different tuning (see the notes). Phase 7 continues meanwhile.

Also still open, not blocking: the owner can add more recordings to `injest-raw/` or `backend/audio_in/` any time.

**Outboard transcriptions (owner request 2026-10-25).** `outboard-guidance/` holds the guide, schema copy and example an external tool or LLM follows to produce riff JSON from a recording; results land in `injest-riff-JSON/` (gitignored) and are validated with `riffspaced.check_riffs`, then opened with File > Open. When files arrive, compare them with the built-in analyzer's output for the same recording and note the differences in docs/ANALYSIS_METHOD.md.

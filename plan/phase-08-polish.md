# Phase 8: Polish and backlog promotion

Goal: finish the items the spec promised for v1 that earlier phases deferred: pitch-preserving transpose and retune, "find an easier tuning", MusicXML and WAV export, the heavy voice if it did not ship in Phase 4, the CRT toggle, full Docker compose, and the public-facing docs (README, user guide, contributor guide). Ends with the final tag and a STATUS.md that says "All phases complete".

Read first: SPEC 3.7, 7.3 to 7.4, 6.2 Heavy, 5.1 CRT, 2 (containers); DECISIONS 9, 34.

## P8.T1 Transpose and retune tools

- `music/transpose.ts`: `transposeRiff(riff, semitones)` per SPEC 3.7 using `bestFingering` with continuity segment by segment; unplayable flagged amber, never dropped. `retuneRiff(riff, newTuning, mode: 'keepShapes' | 'keepPitches')`.
- Edit > Transpose... dialog (semitones ±12, preview count of unplayable notes before applying). Tuning menu: Retune mode toggle; selecting a preset now honors the mode (Phase 2 only did keep-shapes). Custom retune dialog with per-string ±semitone steppers.
- Arrangement tuning mismatch dialog now offers the real "retune, keep pitches" fix.
- Python mirror `music/transpose.py` for the backend's suggestion repair.

Tests: transposing the walkdown by +2 keeps every note playable within 0..12 and preserves intervals; retune keepPitches from Bb Standard to Drop Ab leaves the low-string notes refingered correctly; keepShapes changes pitches on string 6 only.

Commit: `feat(music): add pitch-preserving transpose and retune with unplayable flagging`.

## P8.T2 Find easier tuning

`music/tuningSearch.ts` per SPEC 3.7: candidates = all presets with matching string count plus single-string adjustments of ±1 and ±2 from the current tuning; score = `2.0 * unplayable + 0.5 * totalSpan + 0.2 * handMovement` after refingering with keepPitches; return top 5 with the refingered riff and the score breakdown. Tuning > Find easier tuning... dialog lists them with Apply (one undo step) and Preview (temporary fretboard view).

Tests: a riff with a stretch that is unplayable in E Standard but easy in Drop D ranks Drop D first; the current tuning always appears in the list with its own score for reference.

Commit: `feat(tuning): add find-easier-tuning search with scored, refingered candidates`.

## P8.T3 MusicXML export

`export/musicxml.ts` per SPEC 7.4: part-wise, TAB clef, `<staff-details>` with `<staff-tuning>` per string, measures with `<divisions>` 480, notes with `<technical><string>` and `<fret>`, chords via `<chord/>`, palm mute as `<other-technical>`, ties for notes crossing bar lines, rests filled for gaps. Well-formedness test with the browser `DOMParser` in Vitest; a golden file for the walkdown in `shared/fixtures/golden/walkdown.musicxml`.

File > Export > MusicXML enabled. Owner task recorded in STATUS.md: open the export in MuseScore or Guitar Pro once and report.

Commit: `feat(export): add MusicXML tablature export with golden-file test`.

## P8.T4 WAV export and heavy voice

- File > Export > WAV uses `renderRiffToWav` from Phase 4 with voice choice and bar count; progress toast.
- If `audio/voices/heavy.ts` does not exist yet, build it now per SPEC 6.2 and add Playback > Voice > Heavy. Test with the fake context (sub oscillator present, waveshaper curve monotonic and odd-symmetric).

Commit: `feat(audio): add WAV export and the heavy distorted voice`.

## P8.T5 CRT toggle and visual polish

- View > CRT: CSS-only scanline overlay (`repeating-linear-gradient`), slight text-shadow glow on green text, 2 percent screen curvature is not attempted. Off by default; persisted in the view slice.
- Focus rings in green on every interactive element; verify Tab order through the transport and menus.
- Empty states: library empty text, no-selection inspector text, backend-down explanations, all in the theme voice (short, lower case, terminal style).
- Loading the app with `?demo=1` resets to the demo library (handy for screenshots and for the Pages URL in the README).

Playwright: visual regression snapshots for the main screen with and without CRT (`toHaveScreenshot` with a 2 percent threshold), stored under `e2e/__screenshots__/`.

Commit: `feat(ui): add CRT toggle, focus styling, empty states, and demo reset parameter`.

## P8.T6 Containers and compose, final

- `docker-compose.yml` verified end to end: `docker compose up --build`, frontend on 8080 proxies `/api/*` to the backend (nginx `location /api/`), frontend built with `VITE_BACKEND_URL=/api`. Backend container runs as non-root, has a `HEALTHCHECK` hitting `/health`.
- `make up`, `make down` at the repo root. If Docker is not installed locally, verify the Dockerfiles by building in CI instead: add a `docker` job to `ci.yml` that builds both images (no push).

Commit: `chore(docker): finish compose with nginx API proxy, healthchecks, and CI image builds`.

## P8.T7 Public docs

- `README.md`: screenshot hero (from Phase 5 or 8 screenshots), what it is, live demo link (Pages URL with `?demo=1`), features list, quick start (frontend only, with backend, with Docker), the "learn from the commits" section explaining the WHY/WHAT/LEARN/TEST format with `git log --format` examples, architecture diagram (ASCII), link to every `docs/*.md`, roadmap from `docs/BACKLOG.md`, license.
- `docs/USER_GUIDE.md`: a walkthrough for a guitarist: write a riff, make it a dyad, play it, change tuning, export to your DAW, import a recording, ask the AI. Screenshots throughout.
- `docs/CONTRIBUTING.md`: setup, gates, commit format, where things live, how to add a tuning preset, a technique, a voice, an export, a pipeline stage.
- `docs/LEARNING_LOG.md` Phase 8 entry plus a top-of-file "reading order" list of the 15 most instructive commits across all phases.

This task may use one subagent for USER_GUIDE.md while the main thread writes README and CONTRIBUTING.

Commit: `docs: add README, user guide, contributing guide, and the learning log reading order`.

## P8.T8 Final verification and exit

1. Fresh clone into a temp dir: `git clone <url> /tmp/riff-check && cd /tmp/riff-check/frontend && npm ci && npm run check && npm run e2e && cd ../backend && make install && make check`. All green.
2. Pages URL loads with `?demo=1`, plays, letters toggle works (check via Chrome tools, screenshot into `docs/screenshots/phase-08/pages.png`).
3. Chrome verification script: full tour: open, load walkdown, play, split view, transpose +2, find easier tuning, apply, export MIDI and MusicXML and WAV (downloads appear), CRT on, screenshot, CRT off. Console clean throughout.
4. `STATUS.md`: "All phases complete", with the owner follow-ups list (open MusicXML in a notation app, drop real recordings if skipped, consider the backlog order).
5. Tag `v0.8.0` annotated "v1 complete", push, CI green.
6. Final message to the owner in chat: Pages URL, how to run locally, where to read first (`STATUS.md`, `docs/LEARNING_LOG.md`), and the two or three things that need his ears or his files.

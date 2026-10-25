# PLAN.md: RIFF-SPACED master plan

Nine phases. Each phase file in `plan/` lists numbered tasks (`P<phase>.T<n>`), acceptance criteria, test commands, a Chrome verification script for UI tasks, and the commit for that task. Phases are sequential. A phase's exit gate must pass before the next phase starts.

## Phase map

| Phase | Name | Delivers | Tag |
|---|---|---|---|
| 0 | Bootstrap | Repo on GitHub, frontend and backend skeletons, CI, Pages deploy, docs skeleton, STATUS.md | v0.0.0 |
| 1 | Music core | Pitch, tuning presets, note naming, ticks, riff/arrangement/song types, JSON schemas, validation, migration, fixtures, Python mirror | v0.1.0 |
| 2 | Fretboard | SVG fretboard with theme, dots, letters, flats/sharps, ranges, tuning menu, dev harness route | v0.2.0 |
| 3 | Editor | Tab lanes, add/remove/move notes, dyads, selection, grid, sections, loop length, undo/redo, autosave, inspector | v0.3.0 |
| 4 | Playback | Web Audio engine, scheduler, transport, loop, fretboard highlight sync, playhead, count-in, metronome, split view | v0.4.0 |
| 5 | Files and library | Open/save dialogs, library panel, arrangements and songs, import/export library, text tab export, MIDI export, menus complete | v0.5.0 |
| 6 | Analysis backend | FastAPI service, synth for ground truth, full pipeline, ingest CLI, benchmark, frontend import flow | v0.6.0 |
| 7 | AI layer | Claude SDK integration, style directive, analyze/suggest/cleanup endpoints, suggestions drawer, audition | v0.7.0 |
| 8 | Polish and backlog | Transpose/retune tools, find easier tuning, MusicXML, WAV export, heavy voice if not done, CRT toggle, Docker compose, README and user guide | v0.8.0 |

## Global rules for every task

1. Re-read the task's acceptance criteria before starting it.
2. Write or update tests first when the task is pure logic.
3. Run the gate: frontend `npm run check`; backend `make check`; both if both changed.
4. For UI tasks: `npm run e2e` with screenshots to `docs/screenshots/phase-NN/`, then the Chrome verification script with the Claude in Chrome tools, console must be clean.
5. Commit in the WHY/WHAT/LEARN/TEST format. Push.
6. Rewrite `STATUS.md` (template below).
7. Move on. Do not wait for approval.

## Phase exit gate (every phase)

- All tasks in the phase file are checked off in `STATUS.md`.
- Gates green from a clean checkout: `git stash -u && npm ci && npm run check && cd ../backend && make check` (adapt per phase; backend gates start in Phase 1).
- CI on GitHub is green for the last push (`gh run list --limit 1`, `gh run watch`).
- `docs/LEARNING_LOG.md` has the phase entry with 3 to 6 instructive commit hashes.
- Annotated tag `v0.<phase>.0` pushed.
- `/compact` with focus "RIFF-SPACED: next phase, STATUS.md, open issues".

## STATUS.md template

```markdown
# STATUS

Updated: <ISO timestamp>
Phase: <N> <name>
Last completed task: P<N>.T<k> <title>
Next task: P<N>.T<k+1> <title>

## Preflight
claude: <version> | node: <version> | python: <version> | gh: <ok/not ok> | chrome tools: <available/not available>

## Phase checklist
- [x] P<N>.T1 ...
- [ ] P<N>.T2 ...

## How to run right now
<commands that work at this commit>

## Known issues
- ...

## Waiting on owner
(none)  OR  the exact question and what is blocked
```

## Time and context budget

Expect roughly: Phase 0 small, Phases 1 to 3 medium, Phase 4 medium, Phase 5 medium, Phase 6 large, Phase 7 medium, Phase 8 medium. Use `/compact` at every phase gate and whenever context feels heavy. Use subagents for independent work inside a phase only where a phase file says so (Phase 6 benchmark and Phase 8 docs are the candidates); otherwise work in the main thread so the commit history stays linear and readable.

## Definition of done for the whole project

- `npm run check` and `make check` pass from a fresh clone.
- GitHub Pages serves the frontend; the demo library loads; a riff plays with synced highlighting.
- `python -m riffspaced.ingest` turns the synthetic benchmark WAVs into riff JSON meeting the Phase 6 thresholds.
- With an API key, AI > Analyze returns dyad labels and a style summary for the demo turnaround riff, and AI > Suggest variations returns playable suggestions that audition through the engine.
- Every commit in `git log` has WHY/WHAT/LEARN/TEST sections.
- `STATUS.md` reads "All phases complete".

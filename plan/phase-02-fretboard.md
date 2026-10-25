# Phase 2: Fretboard

Goal: the SVG fretboard component from SPEC 5.3, fully themed, driven by a Zustand store, with a dev harness route so it can be exercised before the editor exists. This is the first visual phase; take screenshots generously.

Read first: SPEC 5.1, 5.2, 5.3; DECISIONS 4 to 6, 13, 15, 25.

## P2.T1 Store foundation

Files: `frontend/src/store/index.ts` (create store with slices), `store/riffSlice.ts` (current riff, `setRiff`, `updateNote`, `addNote`, `removeNotes`, all going through a single `commit(label)` that pushes undo snapshots; undo/redo themselves land in Phase 3 but the snapshot stack exists now), `store/viewSlice.ts` (`showLetters`, `accidentals`, `fretRange: {from, to}`, `realisticSpacing`, `splitView`, `panels`), `store/selectionSlice.ts` (`selectedNoteIds`, `highlightIds`, `editCursorTick`, `activeLane`), `store/persist.ts` (loads demo library from `@shared/fixtures/demo-library.json` on first run; Phase 3 adds autosave).

Tests: slice reducers are pure functions tested directly; `commit` records a snapshot per call.

Commit: `feat(store): add Zustand store with riff, view, and selection slices and demo library bootstrap`.

## P2.T2 Fretboard geometry

File: `frontend/src/fretboard/geometry.ts`, pure functions, no React: `layout(width, height, range, stringCount, realistic)` → `{ fretX(fret), stringY(string), noteX(fret), nutX, markers[] }`. Even spacing by default; realistic spacing uses the `0.944` ratio normalized to fit the width. Open-string note x is `nutX - dotRadius * 1.4`. Dot radius = `min(stringGap * 0.42, fretWidth * 0.38)`.

Tests: known widths produce expected x positions; realistic spacing is monotonic and fits; markers at 3,5,7,9,12(double),15,17,19,21,24 only within range.

Commit: `feat(fretboard): add pure geometry layout for frets, strings, markers, and dots`.

## P2.T3 Fretboard component

Files: `frontend/src/fretboard/Fretboard.tsx` (presentational, props per SPEC 5.3), `FretboardNote.tsx` (one dot, handles states normal/selected/sounding/lowConfidence/unplayable, letter text when enabled), `FretWires.tsx`, `StringLines.tsx`, `Markers.tsx`, `FretNumbers.tsx`, `ChordConnectors.tsx` (thin line between notes sharing `chordId`), `Tooltip.tsx` (hover text `string 6 fret 3 = Db2`), `fretboard.css`.

Rules:
- `<svg viewBox>` sized to the container via a `ResizeObserver` hook `useElementSize`.
- Strings get thicker toward the low side (stroke 1.2 to 2.6).
- Open strings: dot sits left of the nut; nut stroke 5.
- Sounding state: CSS class toggles fill to `--color-flash` and a `transform: scale(1.25)` transition of 80 ms.
- Letters: `<text>` centered, black fill, font-size = dotRadius * 1.1, uses `nameOf(pitch, accidentals, false)`.
- Click handling: an invisible hit rectangle per (string, fret) cell emits `onCellClick({string, fret, shiftKey})`; dots emit `onNoteClick(noteId, {shiftKey, button})`; right-click calls `onNoteContextMenu` and prevents default.
- Everything color comes from CSS custom properties.

Tests (Vitest + testing-library): renders N strings and `to - from + 1` fret cells; a note at string 6 fret 3 renders a dot at the geometry position; letters toggle shows `Db`; sharps toggle shows `C#`; selected and unplayable classes applied.

Commit: `feat(fretboard): render SVG fretboard with dots, letters, markers, chord connectors, and hit areas`.

## P2.T4 Tuning menu and view toggles (temporary toolbar)

Until the real menu bar lands in Phase 5, add `frontend/src/dev/DevToolbar.tsx` rendered above the fretboard: tuning preset `<select>` (grouped Standard / Drop, from `ALL_PRESETS`), note letters checkbox, sharps checkbox, fret range select (`0-12`, `0-24`, `0-5`, `5-17`), realistic spacing checkbox. All bound to the store. Mark the file with a header comment saying it is replaced by the menu bar in P5.T1.

Changing tuning preset in Phase 2 uses "keep shapes" (DECISIONS 7 and SPEC 3.7) because pitch-preserving refingering lands in Phase 8; show the tuning name in a status line.

Commit: `feat(fretboard): add temporary dev toolbar for tuning presets and view toggles`.

## P2.T5 App shell and dev harness route

- `App.tsx`: layout skeleton from SPEC 5.2 with placeholders for menu bar, library, transport, tab lanes, inspector, status bar (each a dim outlined box with its name), and the real Fretboard in the center showing the current riff's notes (all notes, since there is no time filter yet).
- Route `/#/dev/fretboard` (hash router, hand-rolled: read `location.hash`, no dependency) renders a page with four fretboards: Bb Standard 0-12 with dots, same with letters, E Standard 0-24 realistic spacing, and a 7-string B Standard example (add `B Standard 7` preset: 35 40 45 50 55 59 64 and make the preset list tag `stringCount`). Each labeled.

Playwright `e2e/fretboard.spec.ts`: open `/`, assert 6 string lines and 13 fret cells; toggle letters, assert text `Db` exists; switch to sharps, assert `C#`; change range to 0-24, assert 25 cells; open `/#/dev/fretboard`, screenshot each fretboard to `docs/screenshots/phase-02/`. Console must be clean.

Chrome verification script:
1. Open http://localhost:5173. Screenshot. Expect the demo "Walkdown Turnaround" notes as green dots on the bottom three strings, frets 0 to 5, black background, green outlines, fret numbers, markers at 3, 5, 7, 9, double at 12.
2. Tick "Note letters". Screenshot. Expect `Bb`, `Db`, `Ab`, `Eb`, `D`, `C` in dots (and `Db` on string 4 fret 5).
3. Tick "Sharps". Expect `A#`, `C#`, `G#`, `D#`.
4. Choose tuning "Drop Ab". Expect the lowest string's letters shift down a whole step (open string shows `Ab`).
5. Hover a dot: tooltip shows `string 6 fret 3 = Db2`.
6. Open http://localhost:5173/#/dev/fretboard. Screenshot the four boards. Read console: no errors or warnings.

Commit: `feat(app): add layout shell with live fretboard and a dev harness route`.

## P2.T6 Phase exit

- `docs/FRETBOARD.md`: how geometry maps strings and frets to pixels, why SVG, the dot state machine, with a screenshot.
- `docs/LEARNING_LOG.md` Phase 2 entry.
- `STATUS.md`, tag `v0.2.0`, push, CI green, `/compact`.

Exit gate: gates green, Playwright fretboard spec green, screenshots committed, tag pushed.

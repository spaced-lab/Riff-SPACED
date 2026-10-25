# Phase 3: Editor

Goal: a riff can be created and edited from scratch in the browser: tab lanes with a grid, note entry from the fretboard and keyboard, dyads, selection and drag, sections and loop length, undo/redo, inspector, and autosave to localStorage. After this phase the owner can write riffs by hand even without playback.

Read first: SPEC 5.4, 5.6 (loop length and grid only), 5.8, 5.9, 4.1, 7.1; DECISIONS 2, 12, 24, 25.

## P3.T1 Tab lane geometry and rendering

Files: `frontend/src/tab/geometry.ts` (`tickToX`, `xToTick`, `laneY(string)`, zoom as `pxPerBar`), `tab/TabLanes.tsx`, `tab/TabNote.tsx` (rect with fret number, dotted top edge for palmMute, amber for low confidence, hollow amber for unplayable), `tab/Ruler.tsx` (bar numbers, beat ticks, section labels), `tab/GridLines.tsx` (bar, beat, and current grid resolution with three stroke weights), `tab/ChordBrackets.tsx`, `tab/Playhead.tsx` (a `<line>` whose `x` is set via ref; Phase 4 drives it), `tab/EditCursor.tsx`, `tab/tab.css`.

Container scrolls horizontally; the string labels (tuning letters) are a fixed left gutter. Zoom: Ctrl/Cmd + wheel changes `pxPerBar` between 120 and 1200; plain wheel scrolls.

Tests: tick/x round-trip at several zooms; a 4-bar riff renders 4 bar lines + 1; notes positioned by start and sized by duration.

Commit: `feat(tab): render tab lanes with ruler, grid, notes, chord brackets, and zoom`.

## P3.T2 Note entry from the fretboard and keyboard

Store actions (all through `commit`): `addNoteAtCursor(string, fret, {chord: boolean})` uses `editCursorTick` and the current grid duration; if `chord` is true and a note already starts at the cursor, share its `chordId` (create one if needed) and enforce same start. `setEditCursor(tick)` snaps to grid and clamps to the loop. `moveCursor(steps)`, `moveCursorBars(bars)`.

Fretboard wiring: `onCellClick` → `addNoteAtCursor` (shift → chord). `onNoteClick` → select (shift adds to selection). Right-click or Delete → `removeNotes(selected)`.

Keyboard (`frontend/src/hooks/useKeyboard.ts`, one place for all shortcuts, with a table rendered later by Help): arrows per SPEC 5.8; digits build a fret number for `activeLane` with a 400 ms timeout and a visible pending indicator in the status bar (`fret: 1_`); Enter commits, Esc cancels; Up/Down change `activeLane`; Tab toggles letters; `[` `]` change grid; Delete removes; Ctrl/Cmd+A selects all. Ignore shortcuts when focus is in an input.

The fretboard now shows only notes sounding at the edit cursor (plus, dimmed at 35 percent opacity, all other notes in the current bar, as a "ghost" context). Toggle in View: "Ghost notes".

Tests: reducer tests for `addNoteAtCursor` with and without chord; keyboard hook tests with fake timers for the two-digit entry.

Commit: `feat(editor): add note entry from fretboard clicks and keyboard with chord (dyad) support`.

## P3.T3 Selection, drag, resize, clipboard

- Marquee select in the tab lanes (pointer down on empty space, drag, release).
- Drag selected notes: horizontal moves `start` snapped to grid (all selected move together, clamped to loop); vertical moves `string` (fret preserved, pitch changes); Alt+vertical preserves pitch by calling `bestFingering` for the new string, flagging `unplayable` if impossible.
- Drag right edge resizes `duration` (minimum one grid step). Chord members move and resize together.
- Clipboard in the store (not the system clipboard): Ctrl/Cmd+C, X, V (paste at edit cursor preserving relative offsets and strings; new ids and chordIds), D duplicates one grid-length later.
- Pointer handling in `tab/useTabPointer.ts` with explicit state machine `idle | marquee | dragging | resizing`; comment the state machine.

Tests: reducer tests for move, resize, paste, duplicate including chord integrity and clamping; a component test that simulates a drag via pointer events.

Commit: `feat(editor): add marquee selection, drag to move and resize, and internal clipboard`.

## P3.T4 Sections, loop length, grid, quantize

- Transport placeholder bar gains: loop length select (4/8/12/16) calling `setLengthBars(n)`: growing pads the last section; shrinking opens a themed confirm dialog (`components/Dialog.tsx`, no `window.confirm`) listing how many notes would be removed; grid resolution select; `Edit > Quantize selection to grid`.
- Inspector gets a Sections list: label, start bar, length, kind select; add/split/merge/rename; clicking a section sets the edit cursor to its start and (Phase 4) solos it.
- Section validation runs on every change; invalid states are impossible by construction (split/merge only).

Tests: `setLengthBars` padding and truncation; quantize moves starts and durations to the grid; section split/merge invariants hold.

Commit: `feat(editor): add sections, loop length, grid resolution, and quantize`.

## P3.T5 Undo/redo and autosave

- `store/history.ts`: `commit(label)` pushes `{label, snapshot: structuredClone(riff)}`; `undo()`, `redo()`; cap 200; Edit menu labels show `Undo <label>`.
- `store/persist.ts`: subscribe to the store, debounce 500 ms, write the library bundle to `localStorage["riffspaced.library.v1"]`; on load, validate and migrate; corrupted storage is moved aside to `riffspaced.library.v1.corrupt.<timestamp>` and the demo library loads with a status-bar warning (never a modal).
- Status bar shows "saved HH:MM:SS".

Tests: undo/redo sequences; cap; autosave debounce with fake timers; corrupted storage path.

Commit: `feat(store): add undo/redo history and debounced localStorage autosave with corruption fallback`.

## P3.T6 Inspector for notes and dyads

`frontend/src/inspector/Inspector.tsx`: for a selection shows per-note string, fret, pitch name, start (bar.beat.tick), duration, velocity slider, technique checkboxes (all from SPEC 4.1), confidence (read-only unless imported). For exactly two selected notes with the same start, shows the dyad label from `describeDyad`, which note is the root, and whether it is inverted. Editing fields dispatches through `commit`.

Tests: render with the demo riff's first chord selected; assert `P5` and root `Db`.

Commit: `feat(inspector): add note and dyad inspector with technique editing`.

## P3.T7 e2e, Chrome verification, phase exit

Playwright `e2e/editor.spec.ts`: new riff; click fretboard string 6 fret 3; shift-click string 5 fret 3; assert two notes with one chordId exist in the tab; press Right twice; type `5` then Enter on lane 6; assert note; drag a note one bar right; undo; redo; set loop length 8; reload page; assert riff persisted. Screenshots to `docs/screenshots/phase-03/`.

Chrome verification script:
1. Open http://localhost:5173. Load demo "Walkdown Turnaround" (still via dev toolbar select of library riffs; add that select now, replaced in Phase 5). Screenshot: tab lanes show palm-muted eighths with dotted tops, the bar 4 walkdown visible, chord brackets on dyads.
2. Click bar 4 in the ruler. Fretboard shows the held Ab and the walkdown note at the cursor, ghosts for the rest of the bar.
3. Click fretboard string 4 fret 5; a new note appears in the tab at the cursor. Ctrl/Cmd+Z removes it.
4. Select two dyad notes; inspector reads `P5, root Db`. Select the inverted one on the "and" of 4; inspector reads `P4, inverted, root Db`.
5. Reload the page; the edit persists (autosave). Console clean.

Docs: `docs/EDITOR.md` (pointer state machine diagram in ASCII, shortcut table, undo design). `docs/LEARNING_LOG.md` Phase 3 entry. `STATUS.md`, tag `v0.3.0`, push, CI green, `/compact`.

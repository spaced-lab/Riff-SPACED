# The editor

How riffs are written and edited by hand (Phase 3): the tab lanes, note entry, the pointer state machine, keyboard shortcuts, sections, and the undo and autosave design.

![Editor with a dyad entered and a confirm dialog](screenshots/phase-03/confirm-dialog.png)

## Two views of one riff

The fretboard answers "where on the neck", the tab lanes answer "when". They are two views of the same store slice. The fretboard shows the notes sounding at the edit cursor, with the other notes of the current bar drawn dim as ghosts (View > Ghost notes) so the shape of the bar is visible while placing a note in it. The tab lanes show everything: one lane per string with string 1 on top, bar and beat lines, grid lines at the current resolution, section labels in the ruler, chord brackets, the dashed edit cursor, and the bright playhead (driven in Phase 4).

## Entering notes

- Click an empty fret on the fretboard: a note of one grid step appears at the edit cursor on that string. Click a fret on a string that already has a note at the cursor and the fret is replaced, not doubled.
- Shift-click: the new note joins the chord at the cursor. If the existing note had no chord yet, both get a fresh `chordId` and the new note copies the anchor's duration. This is how dyads are built: 6:3 then shift 5:5 is the Db power chord.
- Keyboard: Up and Down pick the active lane (shown in the status bar), digits type a fret for that lane at the cursor. A second digit within 400 ms makes a two-digit fret (`1` `2` is fret 12); `2` then `9` can only be two notes because 29 is past the last fret. Enter commits early, Escape cancels, and the status bar shows `fret: 1_` while a digit is pending.
- Left and Right move the cursor one grid step, Shift makes it a bar. Clicking the ruler moves it too.

## The pointer state machine

`tab/useTabPointer.ts` is a small explicit state machine:

```
idle ──pointerdown on empty space──▶ marquee ──pointerup──▶ idle   (select the notes touched)
idle ──pointerdown on a note──────▶ dragging ──pointerup──▶ idle   (one commit: move)
idle ──pointerdown on a right edge─▶ resizing ──pointerup──▶ idle   (one commit: resize)
```

While dragging or resizing nothing is written to the store. The hook exposes a preview (snapped tick delta, lane delta, or stretched duration) and `TabLanes` draws the selected notes with a transform. One commit on release means one undo step per gesture and no store churn at 60 pointer events a second.

Dragging across lanes keeps the fret and changes the string, so the pitch changes. Hold Alt to keep the pitch: the note is refingered on the new string with `bestFingering`, and flagged `unplayable` (hollow amber) if that string cannot reach the pitch. A chord member always drags its whole chord along; dyads never come apart by accident.

## Selection and clipboard

Click selects, Shift-click adds, a marquee on empty space selects everything it touches, Escape clears, Ctrl/Cmd+A selects all. The clipboard is internal to the store, not the system clipboard: Ctrl/Cmd+C copies the selection with starts made relative to the earliest note, Ctrl/Cmd+V pastes at the edit cursor with fresh ids and fresh chord ids (so the paste is a new chord, not a member of the old one), Ctrl/Cmd+X cuts, Ctrl/Cmd+D duplicates one grid step later. Notes that would start past the loop end are dropped; notes that would cross it are clipped.

## Sections and loop length

A riff is 4, 8, 12 or 16 bars. Growing the loop extends the last section. Shrinking would remove the notes past the new end, so it asks first through the themed dialog (`components/Dialog.tsx`), naming how many notes go; `window.confirm` is never used because browser dialogs block the Chrome extension that verifies the app. Sections can only be split in two or merged with the next one, so they cannot stop covering the loop; the Phase 1 validator remains as a safety net, not as the mechanism. Clicking a section's bar range in the inspector moves the cursor there (Phase 4 also solos it).

Quantize snaps the selected notes' starts and durations to the current grid, never below one step.

## Undo and autosave

Every mutation of the riff goes through `commit(label, change)` in the store. It snapshots the riff before the change, applies the pure `change` function, stamps `updatedAt`, and pushes the snapshot onto the undo stack (capped at 200). Undo pops it and pushes the current riff onto the redo stack; a new edit clears redo. Because `commit` is the only writer, no code path can forget to record history.

Autosave is a store subscription that fires when the `riff` or `library` object identity changes (commit always makes a new object, nothing else does), debounced 500 ms, writing the whole library bundle to `localStorage["riffspaced.library.v1"]` with the current riff's edits folded in, plus the id of the open riff so a reload lands where the owner left off. The status bar shows `saved HH:MM:SS`. On startup the saved bundle is migrated and validated; a corrupt one is never overwritten but moved aside under `riffspaced.library.v1.corrupt.<timestamp>` while the demo library loads and the status bar explains, in amber, what happened.

## Shortcut table

| Keys | Action |
|---|---|
| Left / Right | cursor one grid step; with Shift, one bar |
| Up / Down | active lane |
| 0-9, Enter, Esc | type a fret, commit, cancel |
| Delete / Backspace | remove selection |
| Ctrl/Cmd+A, C, X, V, D | select all, copy, cut, paste at cursor, duplicate |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y | undo, redo |
| [ / ] | coarser / finer grid |
| Tab | toggle note letters |
| Ctrl/Cmd + wheel | zoom the tab lanes |

Space, L, and the BPM keys arrive with playback in Phase 4; the table in `hooks/keyboard.ts` is what Help > Keyboard shortcuts renders in Phase 5.

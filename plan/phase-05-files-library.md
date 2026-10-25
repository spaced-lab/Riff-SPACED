# Phase 5: Files and library

Goal: the three data tiers (riff, arrangement, song) are real, with a library panel, standard open/save dialogs, library import/export, text tab and MIDI export, and the complete menu bar replacing the dev toolbar. After this phase the owner can catalog riffs into songs and move them into a DAW.

Read first: SPEC 4.2 to 4.5, 5.7, 7 (all); DECISIONS 10, 16, 29.

## P5.T1 Menu bar and dialogs

- `frontend/src/menu/MenuBar.tsx` with the full menu tree from SPEC 5.7. Items not yet implemented (MusicXML, PDF, Find easier tuning, AI items, CRT) render disabled with a tooltip `Phase N` so the tree is complete now and fills in later.
- `components/Dialog.tsx` (already exists from Phase 3) gains `prompt`-style text input and a generic form variant. `components/Toast.tsx` for non-blocking status.
- Remove `dev/DevToolbar.tsx`; move its controls into View, Tuning, and Transport.
- Keyboard accelerators shown in menu items; `Help > Keyboard shortcuts` renders the table from `useKeyboard`'s shortcut registry.

Tests: menu renders every top-level menu; disabled items carry the phase tooltip.

Commit: `feat(menu): add full menu bar and themed dialogs, retire the dev toolbar`.

## P5.T2 Library store and panel

- `store/librarySlice.ts`: `riffs`, `arrangements`, `songs` maps by id; `currentRiffId`, `currentArrangementId`, `currentSongId`; CRUD actions; tag add/remove; `search(query)` matching name, tags, tuning name, and section labels (case-insensitive, token AND).
- `library/LibraryPanel.tsx`: three collapsible groups, search box, tag chips, context menu per item (Open, Duplicate, Rename, Delete with confirm, Export). Current item highlighted. Drag a riff onto an arrangement to append it (HTML5 drag and drop).
- Opening a riff with unsaved changes is not a concern (autosave covers it) but the panel shows a `modified` dot since last file save.

Tests: search tokenization; CRUD; drag-append reducer.

Commit: `feat(library): add library panel with search, tags, and three-tier CRUD`.

## P5.T3 Arrangement and song editors

- `arrangement/ArrangementEditor.tsx`: ordered entry list (riff name, repeats, transpose, label), reorder by drag, add from library, remove. Tuning mismatch check per SPEC 4.2 with the offered fix (keep-pitches retune lands in Phase 8; until then the dialog explains and refuses).
- Arrangement playback: the engine accepts a `Playable` that is either a riff or a flattened arrangement (`arrangement/flatten.ts` concatenates riffs with repeats and transposition into one long virtual riff with section markers per entry). The tab lanes show the flattened arrangement read-only with entry boundaries; editing happens in the source riff.
- `song/SongEditor.tsx`: parts list of arrangements with labels, free-text notes, total length readout. Song playback flattens all parts.

Tests: `flatten` with repeats and transpose produces correct ticks and pitches; section markers align.

Commit: `feat(arrangement): add arrangement and song editors with flattened playback`.

## P5.T4 File open and save

- `storage/files.ts`: `openFile(accept)`, `saveFile(blob, suggestedName)` using the File System Access API when `window.showOpenFilePicker` exists, else `<input type=file>` and `<a download>`. Remember the last directory handle in IndexedDB when permitted (`storage/handles.ts`), so "Save" without "Save as" works in Chrome.
- File > Open accepts `.riff.json`, `.arr.json`, `.song.json`, `.riffspaced.json`; validates and migrates; duplicate ids prompt replace or keep both (new id).
- File > Save writes the current item; Save as prompts a name. File > Export library / Import library for the bundle. File > Recent lists the last 10 names from localStorage.

Playwright: fallback path only (no FS Access in headless): trigger Export library, read the download, assert it validates; set the file chooser on Import, assert items appear.

Commit: `feat(storage): add open, save, save-as, and library import/export with FS Access and fallbacks`.

## P5.T5 Text tab export

`export/texttab.ts` per SPEC 7.2. Tests compare against golden files in `shared/fixtures/golden/walkdown.tab.txt` and `tritone.tab.txt` (write the goldens by hand first from the demo riffs, then make the code match; the golden for the walkdown must show the held Ab as `5` on the string-5 line (labeled `Eb`, the open string; fret 5 on it is Ab2 in Bb Standard) followed by `-` dashes while the low string reads `5-5-4-4-3-3-2-2`).

File > Export > Text tab downloads `<name>.tab.txt`. Also `Edit > Copy as text tab` writes to the system clipboard via `navigator.clipboard.writeText` with a toast.

Commit: `feat(export): add ASCII tab export with golden-file tests`.

## P5.T6 MIDI export

`export/midi.ts` per SPEC 7.3: `writeVarLen`, `encodeTrack`, `riffToMidi(riff, {channelPerString})`. Tests: varlen known vectors (0x00, 0x7F, 0x80 → 81 00, 0x3FFF → FF 7F, 0x4000 → 81 80 00); header bytes `MThd 00 00 00 06 00 00 00 01 01 E0`; a one-note riff produces the expected full byte sequence; the demo riff round-trips through a tiny MIDI reader written in the test (`export/midi.reader.test.ts`) that parses our own output back to note events.

File > Export > MIDI with a dialog option for channel-per-string.

Commit: `feat(export): add Standard MIDI File writer with byte-level tests`.

## P5.T7 e2e, Chrome verification, phase exit

Playwright `e2e/library.spec.ts`: create riff, rename, tag, search finds it, create arrangement with two entries, play arrangement, export library, import into a fresh profile, assert identical. Screenshots to `docs/screenshots/phase-05/`.

Chrome verification script:
1. Open http://localhost:5173. Menu bar present; dev toolbar gone. Screenshot.
2. Library panel shows demo riffs, arrangement, song. Search `turn` filters to the walkdown.
3. File > New riff; name it; add two notes; File > Save (FS Access dialog appears in Chrome; save to Downloads). Screenshot of the dialog is not possible; after saving, status bar shows the filename.
4. File > Export > Text tab; open the downloaded file in a new tab via `file://` is not allowed; instead `Edit > Copy as text tab` then paste into the search box to eyeball it, then clear. Confirm the walkdown line reads `5-5-4-4-3-3-2-2` under a held `5`.
5. Open the arrangement; press Space; the tab shows entry boundaries and the readout crosses into the second entry.
6. Help > Keyboard shortcuts renders. Console clean.

Docs: `docs/FILE_FORMATS.md` (the three tiers with examples, the bundle, migration policy, MIDI mapping). `docs/LEARNING_LOG.md` Phase 5 entry. `STATUS.md`, tag `v0.5.0`, push, CI green, `/compact`.

# File formats

What RIFF-SPACED reads and writes (Phase 5). Every document is plain JSON with a `format` and an integer `version`; the schemas in `shared/schema/` are the formal definitions and both the browser and the Python backend validate against them.

| Extension | Format | Holds |
|---|---|---|
| `.riff.json` | `riff-spaced/riff` | one riff: tuning, tempo, length, sections, notes |
| `.arr.json` | `riff-spaced/arrangement` | an ordered list of riff references with repeats and transpose |
| `.song.json` | `riff-spaced/song` | a tuning and an ordered list of arrangement parts |
| `.riffspaced.json` | `riff-spaced/library` | everything: riffs, arrangements, songs (autosave, export, backup) |
| `.tab.txt` | text | ASCII tab, export only |
| `.mid` | Standard MIDI File | export only |
| `.musicxml` | MusicXML 4.0, part-wise | export only (Phase 8) |

## The three tiers

A **riff** is the unit of music: 4, 8, 12 or 16 bars of notes on a tuned guitar. Notes carry `string` (guitarist numbering, 1 is highest), `fret`, `start` and `duration` in ticks at 480 per quarter note, a velocity, techniques, an optional `chordId` that groups a dyad or chord (members must share a `start`), and two fields the importer and the transpose tools set: `confidence` (below 0.6 draws amber) and `unplayable` (hollow amber, silent in playback, never deleted).

```json
{
  "format": "riff-spaced/riff", "version": 1,
  "id": "demo-riff-walkdown", "name": "Walkdown Turnaround",
  "tuning": { "name": "Bb Standard", "pitches": [34, 39, 44, 49, 53, 58] },
  "tempo": { "bpm": 92 }, "timeSignature": { "beats": 4, "unit": 4 }, "ppq": 480,
  "lengthBars": 4,
  "sections": [{ "id": "s1", "label": "A", "startBar": 0, "lengthBars": 4, "kind": "main" }],
  "notes": [{ "id": "n1", "string": 6, "fret": 3, "start": 240, "duration": 240, "velocity": 100,
              "techniques": ["palmMute"], "chordId": "c1" }],
  "tags": ["sludge", "turnaround"], "source": { "type": "manual" }
}
```

An **arrangement** sequences riffs by id. Each entry has `repeats` and a `transpose` in semitones (applied as a shape shift: frets move, strings stay; a fret that would leave the neck is flagged unplayable). All riffs in one arrangement share a tuning; the app refuses a mismatch and, from Phase 8, offers to retune the riff keeping its pitches.

```json
{ "format": "riff-spaced/arrangement", "version": 1, "id": "demo-arr-verse", "name": "Demo verse",
  "tempo": { "bpm": 92 },
  "entries": [{ "riffId": "demo-riff-walkdown", "repeats": 3, "transpose": 0, "label": "Walkdown x3" },
              { "riffId": "demo-riff-tritone", "repeats": 1, "transpose": 0, "label": "Tritone" }] }
```

A **song** lists arrangements as parts with labels and free-text notes. Playback plays the parts back to back at the first arrangement's tempo (a tempo map is backlog).

References are by id, not by copy: edit a riff and every arrangement that uses it plays the new version. The app shows arrangements and songs as a flattened read-only timeline; edits happen in the source riff.

## The library bundle

`{ format, version, exportedAt, riffs, arrangements, songs }`. Autosave writes it to `localStorage["riffspaced.library.v1"]` 500 ms after the last change, with the id of the open riff alongside so a reload lands where you were. File > Export library writes the same bundle to a file; File > Import library merges one in.

Merging asks one question when ids collide: **replace** overwrites the existing copies, **keep both** gives the incoming duplicates new ids and renames them `(imported)`, rewriting the arrangement entries and song parts inside the same import so the copies still point at each other.

## Open and save

Chrome (and other browsers with the File System Access API) gets real file pickers and keeps the file handle in IndexedDB, so File > Save overwrites the same file without asking and still works after a reload. Everywhere else, Open uses a hidden file input and Save downloads the file; Save as always asks. File > Recent lists the last ten names.

## Versioning and migration

`version` is an integer per format. `frontend/src/model/migrate.ts` and `backend/riffspaced/model/migrate.py` upgrade older documents before validation, one guarded step per version; `shared/fixtures/legacy/riff-v0.json` is the fixture that proves the mechanism (v0 had `bars` instead of `lengthBars` and no sections). A document from a newer version is refused with a clear message rather than guessed at. Validation and migration are separate on purpose: migration reshapes without judging, validation judges one shape.

## Text tab

One character per sixteenth, string 1 on top, open-string names at the left, `|` at bar lines, fret numbers at their sixteenth (two-digit frets right-aligned over the previous column), `p` under palm-muted columns on a legend line, four bars per system. Durations are not drawn. Edit > Copy as text tab puts the same text on the clipboard.

```
Bb|----------------|----------------|----------------|----------------|
 F|----------------|----------------|----------------|----------------|
Db|----------------|----------------|----------------|----------------|
Ab|--------------5-|--------------5-|--------------5-|----------------|
Eb|--5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|5---------------|
Bb|0-3-3-3-3-3-3---|3-3-3-3-3-3-3---|3-3-3-3-3-3-3---|5-5-4-4-3-3-2-2-|
  |p-p-p-p-p-p-p-p-|p-p-p-p-p-p-p-p-|p-p-p-p-p-p-p-p-|p-p-p-p-p-p-p-p-|
```

## MIDI mapping

Format 0, one track, 480 PPQ (the same ticks as the riff, so no rounding). Track name, tempo and 4/4 meta events, program change 30 (General MIDI distortion guitar), then note on/off per note with running status. Pitch is the sounding MIDI number from the tuning. Palm mute becomes a note half as long; other techniques are not expressed. Unplayable notes are left out. The export dialog offers one channel per string (string N on channel N-1), which lets a DAW split the strings onto separate instruments.

## MusicXML mapping

Part-wise MusicXML 4.0, one part, one TAB staff (`<clef><sign>TAB</sign>`), `<divisions>` 480 so riff ticks are score durations with no rounding, `<staff-details>` with one `<staff-tuning>` per string (line 1 is the lowest string, as MusicXML counts tab lines from the bottom), and the tempo as a metronome direction with `<sound tempo>`.

MusicXML is sequential inside a measure, so the writer first turns notes into events (same start and duration), writes a chord as the first note followed by notes carrying `<chord/>`, and puts anything that overlaps another event into a second voice reached with `<backup>`; the walkdown's held Ab2 under the moving low string is the case that needs it. Events crossing a bar line are split with `<tie>` and `<tied>`. Gaps become rests. Each note carries `<technical><string>` and `<fret>` so notation apps draw real tab, palm mute is `<other-technical>palm mute</other-technical>`, hammer-ons, pull-offs and slides use their MusicXML elements, and unplayable notes are left out, as in MIDI. `shared/fixtures/golden/walkdown.musicxml` is the pinned output for the demo walkdown; the owner's task is to open an export in MuseScore or Guitar Pro once and report what it looks like.

## Where the code lives

- `frontend/src/model/`: types, validation, migration, factories
- `frontend/src/storage/`: pickers and fallbacks, handles, recents, document parsing and merging
- `frontend/src/export/`: text tab, MIDI, WAV encoding, MusicXML
- `frontend/src/export/`: text tab, MIDI, WAV (Phase 8), MusicXML (Phase 8)
- `backend/riffspaced/model/`: the Python mirror of types, validation and migration

# RIFF-SPACED: Technical Specification

This is the single source of truth for what gets built. Claude Code reads this before every phase. If a phase file and this spec disagree, this spec wins and the phase file gets fixed in the same commit.

Project owner: Ridley (handle SPACED). The app is a browser-based guitar riff-writing and transposing tool for heavy, low-tuned, chromatic riff music (sludge, doom, power metal with a blues-turnaround feel), with a Python audio-analysis backend and an AI layer that understands the owner's musical intent.

---

## 1. Product summary

A single-page web app, dark terminal aesthetic (black background, phosphor-green outlines), that lets the owner:

1. See a guitar neck (nut to 12th fret by default, up to 24) with notes shown as dots, optionally with note letters inside the dots.
2. Enter, edit, and arrange riffs made mostly of dyads and power chords (often inverted) on the lowest three or four strings, in any tuning, with Bb standard as the default.
3. Play riffs back with a basic synth voice, with the fretboard highlighting each note in sync, a timeline showing the position in the loop, and loop lengths of 4, 8, 12, or 16 bars.
4. Save and load riffs, riff sequences (arrangements), and songs as simple JSON, export to MIDI, text tab, and MusicXML.
5. Import a folder of audio recordings and have a Python service turn them into riff JSON laid out on the fretboard the way he actually plays them.
6. Ask an AI layer (Claude) to name the dyads, identify the style, and suggest counter riffs, variations, simplified versions, embellishments, alternate fingerings, and alternate tunings, all honoring the style directive in section 9.

Code must be simple, modern, modular, professional quality, well commented, container-ready, and committed frequently with detailed, human-readable commit messages so that each step can be learned from.

---

## 2. Architecture

```
riff-spaced/
  frontend/          React + TypeScript + Vite single-page app (works alone, no backend needed)
  backend/           Python 3.12, FastAPI, numpy/scipy audio analysis, Claude API client
  shared/            JSON Schemas for the riff formats (consumed by both sides)
  docs/              Learning log, screenshots, architecture notes, user guide
  plan/              The phase files Claude Code works from
  .github/workflows/ CI: lint, unit tests, e2e, build, Pages deploy
  docker-compose.yml Frontend (nginx static) + backend (uvicorn)
```

### 2.1 Frontend stack (fixed)

| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript (strict) | Well trodden, Claude Code builds it reliably, componentized |
| Build | Vite | Fast dev server, static build for GitHub Pages |
| State | Zustand (single store, slices) | Tiny, no boilerplate, easy undo history |
| Rendering | SVG for fretboard and tab lanes, no canvas | Declarative, inspectable in devtools, crisp at any zoom |
| Audio | Web Audio API directly (no Tone.js) | Teachable, no dependency, lookahead scheduler pattern |
| Styling | Plain CSS with CSS custom properties, one theme file | Simple, no Tailwind |
| Tests | Vitest (unit), Playwright (e2e, headless Chromium) | Standard |
| Lint/format | ESLint + Prettier | Standard |
| IDs | `crypto.randomUUID()` | No dependency |

No UI component library. No CSS framework. Dependencies beyond the above require a note in DECISIONS.md.

### 2.2 Backend stack (fixed)

| Concern | Choice |
|---|---|
| Language | Python 3.12 |
| Web | FastAPI + uvicorn |
| Numerics | numpy, scipy (signal, fft, io) |
| Audio I/O | soundfile (WAV, FLAC, OGG); MP3 via ffmpeg CLI if present, otherwise error with a clear message |
| AI client | official `anthropic` Python SDK |
| Tests | pytest |
| Packaging | `pyproject.toml`, `uv` if available else `pip` with a `requirements.txt` lockfile mirror |
| Lint | ruff |

Forbidden in the core analysis path: librosa, essentia, aubio, crepe, basic-pitch, madmom, or any other music-analysis library. The owner wants his own analysis code. numpy and scipy are math libraries and are allowed. A reference library may appear only under `backend/tools/benchmark/` as an optional comparison oracle, off by default, clearly labeled.

### 2.3 Frontend works standalone

The frontend must be fully usable with no backend: editing, playback, local save/load, export. Backend features (audio import, AI) appear in the UI but show a clear "backend not reachable" state when `GET /health` fails. Backend URL comes from `VITE_BACKEND_URL`, default `http://localhost:8000`.

---

## 3. Music model and conventions

All of these live in `frontend/src/music/` (TypeScript) and are mirrored in `backend/riffspaced/music/` (Python). Both have unit tests against the same fixture file `shared/fixtures/music-conventions.json` so the two implementations cannot drift.

### 3.1 Pitch

- MIDI note numbers. C4 = 60, A4 = 69 = 440 Hz. `freq(m) = 440 * 2^((m - 69) / 12)`.
- Pitch class = `m mod 12`, 0 = C.
- Octave = `floor(m / 12) - 1` (so 60 is C4, 34 is Bb1).

### 3.2 Note names

- Default spelling is flats. A global toggle switches to sharps.
- Flats: `C Db D Eb E F Gb G Ab A Bb B`
- Sharps: `C C# D D# E F F# G G# A A# B`
- Display with octave where useful: `Bb1`, `F2`. On the fretboard, letters only (no octave) inside dots.

### 3.3 Strings and tuning

- Strings are numbered the guitarist's way: string 1 is the highest pitch, string N is the lowest. A standard guitar has N = 6. The model supports N = 6, 7, or 8.
- A tuning is stored low to high: `pitches[0]` is string N (lowest), `pitches[N-1]` is string 1.
- `pitchOf(string, fret) = pitches[N - string] + fret`.
- Fret range: 0 (open) to `fretCount` (24 by default). Default view range 0 to 12.

Tuning presets (6 string, low to high, MIDI numbers). Bb Standard is the app default.

| Name | Pitches | Notes |
|---|---|---|
| E Standard | 40 45 50 55 59 64 | E2 A2 D3 G3 B3 E4 |
| Eb Standard | 39 44 49 54 58 63 | |
| D Standard | 38 43 48 53 57 62 | |
| C# Standard | 37 42 47 52 56 61 | |
| C Standard | 36 41 46 51 55 60 | |
| B Standard | 35 40 45 50 54 59 | |
| **Bb Standard** | **34 39 44 49 53 58** | **Bb1 Eb2 Ab2 Db3 F3 Bb3, app default** |
| A Standard | 33 38 43 48 52 57 | |
| Drop D | 38 45 50 55 59 64 | |
| Drop C# | 37 44 49 54 58 63 | |
| Drop C | 36 43 48 53 57 62 | |
| Drop B | 35 42 47 52 56 61 | |
| Drop Bb | 34 41 46 51 55 60 | |
| Drop A | 33 40 45 50 54 59 | |
| Drop Ab | 32 39 44 49 53 58 | Bb Standard with the low string dropped a whole step |

"Drop" presets are generated from the matching standard tuning by lowering `pitches[0]` by 2 semitones; the table above is the expected output of that generator and is a unit test.

Custom tunings: any array of N integers in ascending order, each between 20 and 70. A "Retune" dialog lets the user adjust each string by semitones.

### 3.4 Time

- `ppq` (ticks per quarter note) = 480 everywhere. Never use floating seconds in stored data.
- 4/4 only for v1, so one bar = 1920 ticks, one sixteenth = 120 ticks. `timeSignature` is stored anyway for forward compatibility; the UI shows 4/4 and the field is read-only until mixed meters leave the backlog.
- `ticksToSeconds(t, bpm) = t / ppq * 60 / bpm`.
- Grid resolutions offered in the editor: 1/4, 1/8, 1/16, 1/8T, 1/16T (triplets = 160 and 80 ticks).
- Loop lengths: 4, 8, 12, 16 bars. Loop always starts at bar 0 of the riff unless a section is soloed.

### 3.5 Intervals and dyads

A dyad is two notes with the same `chordId`. Interval = `|pitch2 - pitch1|` mod 12, plus a flag for which note is lower.

| Semitones | Label | Common meaning here |
|---|---|---|
| 0 | unison/octave | octave dyad |
| 1 | m2 | chromatic clash |
| 2 | M2 | |
| 3 | m3 | minor dyad |
| 4 | M3 | major dyad |
| 5 | P4 | inverted power chord (root on top) |
| 6 | TT | tritone |
| 7 | P5 | power chord |
| 8 | m6 | |
| 9 | M6 | |
| 10 | m7 | |
| 11 | M7 | |

`describeDyad(a, b)` returns `{ interval, semitones, lowerIsRoot: boolean, rootPitchClass }`. For P4 the root is the upper note (inverted fifth). For P5 the root is the lower. For other intervals `root` follows the lower note by default. Multiple naming *modes* (interval, power-chord, implied-triad) are backlog; only the data function ships in v1 and the inspector displays the interval label.

### 3.6 Fingering search (used by transpose, retune, import)

`findFingerings(pitch, tuning, options)` returns all `(string, fret)` pairs producing `pitch` within `options.fretRange` (default 0 to 12 for low strings, 0 to 24 if asked) restricted to `options.allowedStrings` (default strings N, N-1, N-2, N-3, i.e. the lowest four).

`bestFingering(pitches[], tuning, previous?)` picks a set of positions for a simultaneous group minimizing: fret span (max fret - min fret, must be 4 or less, open strings excluded from span), distance from `previous` hand position, and a preference for lower strings. Deterministic; ties resolved by lower string, then lower fret.

### 3.7 Transpose and retune

- **Transpose by semitones (keep tuning)**: every pitch shifts by k; refinger with `bestFingering` segment by segment using continuity. Unplayable notes (no fingering within range) are flagged `unplayable: true` and shown amber; never silently dropped.
- **Retune, keep pitches**: new tuning, same sounding notes, refinger as above.
- **Retune, keep shapes**: new tuning, same `(string, fret)` pairs, pitches change. This is the "one click lower everything" the owner mostly wants.
- **Find easier tuning** (Phase 8): search all presets and all single-string adjustments of ±1, ±2 from the current tuning; score each by total fret span, hand movement, and count of unplayable notes; present the top 5.

---

## 4. Data formats (JSON)

JSON Schemas live in `shared/schema/*.schema.json` (draft 2020-12). The frontend validates on load with a small hand-written validator for the fields that matter (no ajv dependency) and the backend validates with `jsonschema`. Every file carries `format` and `version`.

### 4.1 Riff (`riff-spaced/riff`, version 1)

```json
{
  "format": "riff-spaced/riff",
  "version": 1,
  "id": "4b1b7a66-2b8f-4a37-9f1a-7f0b9b7f6a21",
  "name": "Walkdown A",
  "createdAt": "2026-10-24T19:00:00Z",
  "updatedAt": "2026-10-24T19:05:00Z",
  "tuning": { "name": "Bb Standard", "pitches": [34, 39, 44, 49, 53, 58] },
  "tempo": { "bpm": 92 },
  "timeSignature": { "beats": 4, "unit": 4 },
  "ppq": 480,
  "lengthBars": 4,
  "sections": [
    { "id": "s1", "label": "A", "startBar": 0, "lengthBars": 4, "kind": "main" }
  ],
  "notes": [
    {
      "id": "n1",
      "string": 6,
      "fret": 3,
      "start": 0,
      "duration": 240,
      "velocity": 100,
      "techniques": ["palmMute"],
      "chordId": "c1",
      "confidence": 1.0,
      "unplayable": false
    },
    {
      "id": "n2",
      "string": 5,
      "fret": 3,
      "start": 0,
      "duration": 240,
      "velocity": 100,
      "techniques": ["palmMute"],
      "chordId": "c1",
      "confidence": 1.0
    }
  ],
  "tags": ["sludge", "turnaround", "palm-mute"],
  "style": { "genres": ["sludge", "doom"], "notes": "" },
  "namingPrefs": { "accidentals": "flats" },
  "source": { "type": "manual" }
}
```

Field rules:

- `notes[].string`: integer 1..N. `fret`: integer 0..fretCount. `start`, `duration`: integer ticks, `duration >= 1`. `velocity`: 1..127.
- `techniques`: subset of `palmMute, letRing, slideUp, slideDown, bend, hammerOn, pullOff, vibrato, dead, harmonic, tremolo`. v1 playback honors `palmMute` (short decay), `dead` (noise burst, no pitch), `letRing` (long release). The rest are stored and displayed, not sonified, until the backlog.
- `chordId`: optional; notes sharing one are a dyad or chord and must share `start`. Validator enforces that.
- `confidence`: 0..1, default 1. Values below 0.6 render amber. Set by the audio importer.
- `sections`: non-overlapping, cover 0..lengthBars. `kind` in `main, variation, turnaround, bridge, other`.
- `source.type` in `manual, audio, ai`. For `audio`: `audioFile`, `analysisVersion`, `bpmDetected`. For `ai`: `model`, `promptVersion`, `parentRiffId`.

### 4.2 Arrangement (`riff-spaced/arrangement`, version 1)

An ordered sequence of riff references with repeats and per-entry overrides. This is the "riff sequence" tier.

```json
{
  "format": "riff-spaced/arrangement",
  "version": 1,
  "id": "...",
  "name": "Verse build",
  "tempo": { "bpm": 92 },
  "entries": [
    { "riffId": "...", "repeats": 4, "transpose": 0, "label": "A x4" },
    { "riffId": "...", "repeats": 1, "transpose": 0, "label": "Turnaround" }
  ],
  "tags": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Riffs inside one arrangement must share a tuning; the UI refuses to add a mismatched riff and offers "retune, keep pitches" to fix it.

### 4.3 Song (`riff-spaced/song`, version 1)

```json
{
  "format": "riff-spaced/song",
  "version": 1,
  "id": "...",
  "title": "...",
  "tuning": { "name": "Bb Standard", "pitches": [34, 39, 44, 49, 53, 58] },
  "parts": [
    { "arrangementId": "...", "label": "Intro" },
    { "arrangementId": "...", "label": "Verse" }
  ],
  "notes": "free text",
  "tags": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 4.4 Library bundle (`riff-spaced/library`, version 1)

One file that holds everything for export/import and backup: `{ format, version, exportedAt, riffs: [], arrangements: [], songs: [] }`. Autosave writes this bundle to `localStorage["riffspaced.library.v1"]` debounced at 500 ms. Individual riffs are also saved as separate `.riff.json` files on demand.

### 4.5 Versioning

`version` is an integer. A `migrate(doc)` function in `frontend/src/storage/migrate.ts` upgrades older versions in place and is unit tested with a fixture per old version. Backend has the same in Python.

---

## 5. UI specification

### 5.1 Theme

- Background `#000000`. Primary phosphor green `#33ff33`. Dim green `#0f6b0f` for grid and inactive outlines. Mid green `#1fbf1f` for secondary text. Amber `#ffb000` for warnings, low confidence, unplayable. Bright flash `#ccffcc` for the currently sounding note. Red `#ff4040` only for errors.
- Font: monospace stack `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`. No webfont download in v1.
- Everything is outlined, not filled, except note dots (filled green) and the active note (filled bright).
- Optional "CRT" toggle in View menu adds a subtle scanline overlay and slight glow via CSS only. Off by default. Phase 8.
- Theme values live in `frontend/src/theme.css` as CSS custom properties. Nothing hardcodes a color elsewhere.

### 5.2 Layout

```
+------------------------------------------------------------------+
| Menu bar: File  Edit  View  Tuning  Playback  AI  Help            |
+------------------+-----------------------------------------------+
| Library (toggle) | Fretboard (full width of center)              |
|  search, tags    |                                               |
|  riffs           +-----------------------------------------------+
|  arrangements    | Transport: [play][stop][loop] BPM [92] Loop [4]|
|  songs           |   grid [1/16]  count-in [ ]  metronome [ ]     |
|                  |   position 02.3.120                           |
|                  +-----------------------------------------------+
|                  | Tab lanes / timeline (6 string lanes, bars)    |
|                  |                                               |
+------------------+-----------------------------------------------+
| Inspector (right, collapsible): selected note(s), dyad info,      |
| techniques, tuning, naming toggles, section list                   |
+------------------------------------------------------------------+
| Status bar: tuning name, backend status, last autosave time        |
+------------------------------------------------------------------+
```

Responsive down to 1024 px wide; below that, panels stack. Mobile is not a target.

### 5.3 Fretboard component

- Horizontal. Nut at the left. String N (lowest) at the **bottom**, string 1 at the top, matching tab orientation.
- Fret numbers above the neck. Fret wires as vertical lines, nut thicker. Position markers (single dot at 3, 5, 7, 9, 15, 17, 19, 21; double at 12 and 24) drawn as dim circles between wires.
- View range selector: `0-12` (default) and `0-24`, plus a free range `a-b`. Fret width scales to fit the container; realistic narrowing (each fret 0.944 of the previous) is a View toggle, off by default so riffs read evenly.
- Notes render as dots centered between fret wires on the string line (open strings just left of the nut). Dot states: normal (green fill), selected (green fill, white outline), sounding (bright fill, brief 80 ms scale pulse), low-confidence (amber fill), unplayable (amber outline, hollow).
- Letter toggle (View > Note letters) writes the note name inside the dot in black text. Flats/sharps toggle affects letters.
- Fingering hint: notes sharing a `chordId` get a thin connector line between them.
- Hover shows a tooltip `string 6 fret 3 = Db2`.
- Interaction (edit mode): click an empty fret/string position to add a note at the edit cursor with the current grid duration. Shift-click adds a note to the chord at the cursor (same `start`, shared `chordId`). Clicking an existing dot selects it; right-click or Delete removes it.
- Props: `tuning, notes (visible set), highlightIds, selectedIds, range, showLetters, accidentals, onCellClick, onNoteClick`. Pure presentational component; all state in the store.

### 5.4 Tab lanes / timeline

- N horizontal lanes (string 1 on top, string N on bottom), time flows left to right. Bar lines, beat lines, grid lines at current resolution. Bar numbers above.
- A note is a rectangle from `start` to `start + duration` on its string lane with the fret number inside. Palm-muted notes get a dotted top edge. Chords (shared `chordId`) get a thin vertical bracket.
- Playhead: vertical bright line driven by `requestAnimationFrame` directly on a ref (no React re-render per frame). Loop region shaded dimly. Section boundaries labeled.
- Edit cursor: separate dim vertical line that snaps to the grid; moved by clicking in the ruler or with arrow keys.
- Interactions: click a note selects; drag moves in time (snaps to grid) and across lanes (changes string, fret preserved, pitch changes; hold Alt to preserve pitch and refinger); drag right edge resizes; marquee select; Ctrl/Cmd+C, V, X, D (duplicate); Delete.
- Zoom with Ctrl+wheel; horizontal scroll with wheel.

### 5.5 Four-way split view

View > Split view toggles a 2x2 grid of mini fretboards replacing the single fretboard. Each quadrant shows one quarter of the loop (`lengthBars / 4` bars each, so 1, 2, 3 or 4 bars per quadrant). A quadrant shows all notes in its range as dots (letters optional), its bar range as a title, and the active quadrant is outlined bright during playback. The sounding note still flashes in whichever quadrant it belongs to. The single fretboard view and the split view are both pure views over the same store slice.

### 5.6 Transport

Play/Stop (Space), Loop on/off (L), BPM numeric input (30 to 300) with ±1 and ±5 buttons, loop length selector (4/8/12/16 bars; changing it resizes `lengthBars` and pads or truncates sections with a confirm if notes would be cut), grid resolution selector, count-in toggle (one bar of clicks before loop start), metronome toggle, position readout `bar.beat.tick` 1-based. Solo section: clicking a section label in the inspector loops only that section.

### 5.7 Menus

- **File**: New riff, New arrangement, New song, Open (file), Save (file), Save as, Import library, Export library, Export > MIDI / Text tab / MusicXML (Phase 8) / PDF (backlog), Import from audio (needs backend), Recent.
- **Edit**: Undo, Redo, Cut, Copy, Paste, Duplicate, Select all, Delete, Transpose..., Quantize selection to grid.
- **View**: Note letters, Sharps, Fret range, Realistic fret spacing, Split view, Library panel, Inspector panel, CRT (Phase 8).
- **Tuning**: preset list (grouped Standard / Drop), Custom retune..., Retune mode (keep shapes / keep pitches), Find easier tuning... (Phase 8).
- **Playback**: Play, Stop, Loop, Count-in, Metronome, Voice (Basic / Heavy), Solo section.
- **AI**: Analyze riff, Suggest variations, Suggest counter riff, Simplify, Embellish, Alternate fingerings, Alternate tunings, Settings (backend URL, model). All disabled with a reason when backend is down.
- **Help**: Keyboard shortcuts, About, Open docs.

File open/save uses the File System Access API when available (Chrome) and falls back to `<input type=file>` and an `<a download>` blob otherwise. Dialogs are custom components styled like the theme (no `window.prompt`, no `alert`, no `confirm`, since those block the Chrome extension used for testing).

### 5.8 Keyboard shortcuts

Space play/stop; L loop; Left/Right move edit cursor one grid step (Shift: one bar); Up/Down change selected lane; digits type a fret number for the selected lane at the cursor (two digits within 400 ms accepted), Enter commits, Esc cancels; Delete removes selection; Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo; Ctrl/Cmd+S save; `[` and `]` change grid resolution; `-` and `=` change BPM by 1; Tab toggles letters.

### 5.9 Undo/redo

A history stack of serialized riff snapshots (structural sharing not required; riffs are small). Cap 200 entries. Every store action that mutates the current riff pushes a snapshot through one `commit(label)` helper so there is exactly one place to get this right. Autosave is separate from undo.

---

## 6. Playback engine

Location `frontend/src/audio/`. No React inside this folder; it is plain TypeScript with a small event emitter, so it can be unit tested with a fake clock.

### 6.1 Clock and scheduler

- One `AudioContext`, created on first user gesture (browser autoplay rule). Resume on play.
- Lookahead scheduler: a `setInterval` every 25 ms schedules all events whose time falls within `now + 0.1 s`. Events are `{ tick, noteIds[], kind: 'noteOn' | 'noteOff' | 'click' }`.
- Position is derived from `audioContext.currentTime - startTime` and the tempo, converted to ticks. Loop wrap is handled by scheduling the next pass before the loop end, never by resetting the clock mid-pass.
- Tempo changes while playing restart the scheduler at the current tick.
- Visual sync: the scheduler also pushes `{ audioTime, noteIds, on: boolean }` into a visual queue; a `requestAnimationFrame` loop drains events whose `audioTime <= audioContext.currentTime` and updates `highlightIds` in the store (batched per frame) and moves the playhead ref.

### 6.2 Voices

- **Basic** (default): per note, two oscillators (sawtooth at f, square at f detuned +4 cents) through a lowpass biquad (cutoff 2.5 kHz, Q 1) into an ADSR gain (A 3 ms, D 150 ms to sustain 0.6, R 60 ms). `palmMute`: decay 90 ms, sustain 0, release 30 ms, cutoff 1.2 kHz. `letRing`: release 400 ms. `dead`: 40 ms white noise burst through a bandpass at 180 Hz, no oscillators. Velocity scales gain linearly from 0.25 to 1.0.
- **Heavy** (Phase 4 stretch, else Phase 8): adds a sub oscillator one octave down at 0.4 gain, a WaveShaper with a tanh curve (drive 6), then a cabinet-like lowpass at 4 kHz and a highpass at 70 Hz. Intentionally crude; samples and a serious amp sim are backlog.
- Master: gain 0.5 into a `DynamicsCompressorNode` (threshold -12 dB, ratio 4) into destination. Polyphony cap 12 voices; oldest stolen.
- Metronome click: 2 ms noise through a highpass at 2 kHz, louder on beat 1.

### 6.3 Rendering offline

`renderRiffToWav(riff, voice)` uses an `OfflineAudioContext` to produce a WAV blob for Export > WAV (Phase 8) and for e2e tests that verify non-silence.

---

## 7. Storage, files, exports

### 7.1 Local storage

Autosave bundle as in 4.4. On startup, load the bundle; if absent, load `shared/fixtures/demo-library.json` (two demo riffs including a Bb-standard palm-muted blues turnaround walkdown: one note held, the other walking down chromatically by half steps, exactly the owner's signature move) so the app never opens empty.

### 7.2 Text tab export

Standard ASCII tab, one line per string, string 1 on top, tuning letters at left, bar lines as `|`, sixteenth columns, fret numbers right-aligned in 2 columns, `p` under palm-muted columns on a legend line, chord notes vertically aligned. 4 bars per system. Riff name, tuning, BPM in a header.

### 7.3 MIDI export

Hand-written Standard MIDI File writer (`frontend/src/export/midi.ts`, format 0, one track, 480 PPQ): tempo meta, time signature meta, track name, program change 30 (Distortion Guitar), note on/off from ticks with running status, end of track. Variable-length quantities unit tested against known byte sequences. Palm mute is expressed as shortened duration only. Option: one MIDI channel per string (channels 1..N) for DAW string-split workflows, default single channel.

### 7.4 MusicXML export (Phase 8)

Part-wise MusicXML 4.0 with TAB staff (`<clef><sign>TAB</sign>`), `<staff-details>` with string tunings, `<technical><string>` and `<fret>` per note, `<notations>` for palm mute as `<other-technical>palm mute</other-technical>`. Validated by opening in MuseScore manually once (owner task) and by an XML well-formedness test automatically.

### 7.5 Import

JSON files of any of the three formats or a library bundle; validated and migrated; duplicates by `id` prompt replace/keep-both.

---

## 8. Audio analysis backend (Python)

Location `backend/riffspaced/`. Goal of Stage 1: a folder of recordings in, riff JSON out, placed on the fretboard the way the owner plays (lowest three strings, sometimes the fourth, mostly dyads, heavy distortion and fuzz, lots of overtones, palm muting).

### 8.1 Reality check on "send audio to Claude"

The plan originally assumed recordings could be sent straight to Claude for transcription. Checked against the Messages API reference on 2026-10-24: content blocks are text, image (JPEG/PNG/GIF/WebP), document (PDF/plain text) and tool blocks. There is no audio block. Claude Code re-checks `https://platform.claude.com/docs/en/api/messages` at the start of Phase 6 in case that changed; unless it did, the division of labor is:

- **Python** extracts a symbolic note-event list from the waveform (this section).
- **Claude** receives the symbolic events plus the style directive and does the musical reasoning: cleanup, dyad naming, style identification, suggestions (section 9).

Either way the pipeline below is required, because the owner's stated end goal is his own local analysis anyway, iterated against what an advanced AI produces for the same material.

### 8.2 Pipeline (module per stage, each a pure function with a dataclass in and out)

1. **load** (`io.py`): read file, mix to mono (float32), resample to 44100 Hz if needed (scipy.signal.resample_poly), normalize peak to -1 dBFS.
2. **preprocess** (`preprocess.py`): highpass 35 Hz and lowpass 6 kHz (Butterworth, `sosfiltfilt`). Keep a copy of the unfiltered mono for later experiments.
3. **frames** (`stft.py`): STFT with Hann window, `n_fft` 4096, hop 512 (11.6 ms at 44.1 kHz). Magnitude in dB with a -80 dB floor. Low tunings need the long window: Bb1 is 58.3 Hz and the bin spacing at 4096 is 10.8 Hz; also compute a parabolic-interpolated peak list per frame for finer resolution.
4. **onsets** (`onsets.py`): spectral flux (half-wave rectified positive differences of log magnitude summed over 60 Hz to 5 kHz), smoothed, adaptive threshold (local mean over ±0.35 s plus delta), peak picking with a 50 ms minimum gap. Palm-muted chugs produce very clean onsets; sustained dyads with vibrato produce weak ones, so a secondary "pitch change" onset detector adds an onset when the dominant pitch estimate jumps by 1 semitone or more for 3 consecutive frames.
5. **tempo** (`tempo.py`): autocorrelation of the onset strength envelope over 40 to 220 BPM with a mild prior around 70 to 140; return top 3 candidates with scores. User can override from the UI; the chosen BPM is stored in `source.bpmDetected` and `tempo.bpm`.
6. **segments**: inter-onset intervals become candidate note events; each segment's spectrum is the median magnitude over its frames after the first 20 ms (skip the attack transient).
7. **pitch hypotheses** (`fingering_match.py`), the core idea, which is the owner's own method and must be documented in `docs/ANALYSIS_METHOD.md`:
   - Enumerate every playable event on the current tuning within the search space: single notes on the lowest four strings, frets 0 to 12 (configurable to 15), and dyads on adjacent or one-apart string pairs with fret span 4 or less. For Bb standard, six strings, that is a few hundred candidates, cheap to score exhaustively.
   - For each candidate build a **predicted spectrum**: for each pitch a harmonic comb (fundamental through the 12th harmonic, weights `1/h^0.8`, slight inharmonicity `f_h = h f_0 sqrt(1 + B h^2)` with `B = 2e-4` for heavy strings), plus for dyads intermodulation terms `|f1 - f2|`, `f1 + f2`, `2f1 - f2`, `2f2 - f1` at weight 0.15 each (distortion creates these and they are what makes naive pitch detection fail on fuzzed dyads). Gaussian peak width 1.5 bins.
   - Score = cosine similarity between the predicted spectrum and the observed segment spectrum, both in a log-frequency-weighted magnitude domain (`sqrt` compression). Add a small bonus for candidates whose fundamentals appear as actual interpolated peaks.
   - Also score a **silence/dead** candidate (flat noise template) so gaps and dead notes are explicit.
8. **decode** (`decode.py`): Viterbi over segments with emission = similarity score and transition cost = hand movement (fret distance of the lowest fretted finger, string change penalty, bonus for repeating the previous shape, which is what riffs do). Output the best path and the per-segment posterior margin as `confidence`.
9. **quantize** (`quantize.py`): snap onsets to the nearest 1/16 at the chosen BPM with a tolerance window; choose the downbeat offset that maximizes onset energy on beats 1 and 3 across the file; durations = next onset minus start, clipped to the grid; classify `palmMute` when the segment's energy decays below -20 dB relative to its peak within 120 ms.
10. **emit** (`emit.py`): build a riff JSON (section 4.1), `source.type = "audio"`, `lengthBars` rounded up to 4/8/12/16, `sections` as one `main` section, `tags: ["imported"]`.

Every stage logs timing and writes optional debug PNGs (spectrogram with detected onsets, candidate score matrix) to `backend/debug/` when `RIFFSPACED_DEBUG=1`, using matplotlib (allowed for debug plots only).

### 8.3 Ground truth and benchmark (how Claude Code tests this without the owner's recordings)

`backend/riffspaced/synth.py` renders a riff JSON to WAV with a Karplus-Strong plucked string per note (loop length from pitch, damping tuned for low strings), palm mute as faster damping, then a static nonlinearity (`tanh(drive * x)`, drive 4 to 12) plus a 4 kHz lowpass to imitate fuzz. This is the owner's own crude amp, not a library.

`backend/tools/benchmark/run.py` renders every fixture riff at three drive levels and two noise levels, runs the pipeline, and reports: onset F1 (±30 ms), note F1 (pitch and onset), fingering accuracy (string and fret both right), dyad accuracy, BPM error. Results are written to `docs/benchmarks/latest.md` and committed, so progress is visible in git history. Acceptance thresholds are in the Phase 6 file. Real recordings from the owner go in `backend/audio_in/` (gitignored) and are a HARD STOP item: Claude Code asks for them rather than inventing them.

### 8.4 CLI and API

- CLI: `python -m riffspaced.ingest ./audio_in --out ./riffs_out --tuning "Bb Standard" [--bpm 92] [--max-fret 12] [--strings 6,5,4] [--ai]` processes every supported file in the folder, writes `<name>.riff.json` and `<name>.report.md` (confidence summary, BPM candidates, warnings). `--ai` runs the Claude cleanup pass (section 9).
- API (FastAPI, CORS allowing the frontend origin):
  - `GET /health` → `{ status, version, aiConfigured: bool }`
  - `POST /analyze` multipart audio + JSON options → riff JSON + report
  - `POST /analyze/batch` zip or multiple files → array
  - `POST /ai/analyze`, `POST /ai/suggest` (section 9)
  - `GET /tunings` presets
  - OpenAPI docs at `/docs` (FastAPI default), used as a smoke test.

---

## 9. AI layer

Location `backend/riffspaced/ai/`. Uses the `anthropic` SDK. Model name is a config value (`RIFFSPACED_MODEL`, default the current Sonnet-class model named in DECISIONS.md), API key from `ANTHROPIC_API_KEY`. Never commit a key. If the key is missing the endpoints return 503 with `{ reason: "ANTHROPIC_API_KEY not set" }` and the frontend shows that text.

### 9.1 Style directive (the owner's words, verbatim, stored at `backend/riffspaced/ai/prompts/style_directive.md`)

> My style is heavily chromatic and built on dissonance and resolution. It is classical in feel. Dissonance is intentional, never a mistake. It creates an unexpected, uneasy feel, sometimes resolved and sometimes deliberately left unresolved, and that unease can itself be the comforting part for the listener. I play sludge, doom and power metal with a blues-turnaround feel, mostly dyads and power chords, often inverted so the root is not the lowest note, mostly on the lowest three strings and sometimes the fourth, with heavy distortion and fuzz and a lot of palm muting. I often play the classic blues turnaround, one note held while the other walks down chromatically by half steps, as heavy palm-muted distorted dyads. I play by ear and feel. Any analysis or suggestion must understand and use this: do not "correct" dissonance, do not resolve what I left open unless asked, and keep the blues-turnaround feel inside the heavy style.

The prompt builder injects this directive, the tuning, the riff JSON, and a strict output contract. Every prompt file has a `promptVersion` header; responses record it in `source.promptVersion`.

### 9.2 Operations

| Endpoint | Input | Output |
|---|---|---|
| `POST /ai/analyze` | riff JSON | `{ dyads: [{chordId, label, altLabels[], root, inverted}], style: { keyCenterGuess, modeGuess, chromaticDevices[], turnaroundDetected: bool, summary }, warnings[] }` |
| `POST /ai/suggest` with `kind` in `variation, counterRiff, counterMelody, switchUp, simplify, embellish, newInStyle, fingerings, tunings` and `count` (1 to 4) | riff JSON (+ optional free-text intent) | `{ suggestions: [{ riff: <riff JSON, source.type ai>, rationale, playingNotes }] }` |
| `POST /ai/cleanup` | imported riff JSON with confidences + report | corrected riff JSON + `changes[]` explaining each edit |

The model must return JSON only. The backend validates the returned riffs against the schema, runs `bestFingering` to repair unplayable notes, and rejects anything that fails validation twice (one retry with the validation error appended). Returned riffs keep the input tuning unless `kind = tunings`.

### 9.3 Frontend integration

Suggestions appear in a right-side "Suggestions" drawer as cards: name, rationale, mini fretboard preview, buttons Audition (plays it through the same engine without replacing the current riff), Add as variation (appends a section to the current riff or creates a sibling riff tagged `ai`), Discard. Nothing from the AI ever overwrites the user's riff without an explicit click, and every accepted suggestion is one undo step.

---

## 10. Git, commits, and learning log

- Repository name `riff-spaced`, public, on the owner's GitHub (see CLAUDE.md for the owner variable). Created and pushed in Phase 0 with `gh`.
- Commit after every task in a phase file. Message format:

```
<type>(<scope>): <summary in plain English, under 72 chars>

WHY: one or two sentences on the motivation.
WHAT: bullet list of concrete changes.
LEARN: one paragraph a newcomer could learn from (the concept, the trap avoided,
       the pattern used). Skip only for pure chores.
TEST: how this was verified (unit, e2e, Chrome screenshot path).
```

Types: `feat, fix, refactor, test, docs, chore, ci, perf`. Scopes: `music, fretboard, tab, audio, store, storage, export, backend, analysis, ai, ci, docs`.

- Push after every commit (`git push`). Tag at the end of each phase: `v0.<phase>.0`, annotated, with a summary.
- `docs/LEARNING_LOG.md` gets an entry per phase: what was built, the key idea, and links to the most instructive commits by hash.
- `STATUS.md` at the repo root is rewritten at every checkpoint: current phase, last completed task, next task, open questions for the owner, how to run. This is how the owner catches up after an unattended run.

---

## 11. Quality gates (all phases)

- `npm run lint`, `npm run typecheck`, `npm run test` pass. Backend: `ruff check`, `pytest` pass.
- No `console.error` or uncaught exceptions in the browser during the phase's Chrome verification script.
- e2e Playwright suite passes headless and writes screenshots to `docs/screenshots/phase-NN/`.
- Lighthouse is not required. Bundle size target under 400 kB gzipped for the frontend.
- Accessibility baseline: every button has a label, keyboard shortcuts documented, focus visible in green.

---

## 12. Backlog (explicitly out of v1, carried in `docs/BACKLOG.md`)

Dyad naming modes (interval / power-chord / implied triad); mixed meters and odd time; tempo map; slow practice loops with speed ramp; riff version history; link a riff to its source recording with waveform display; PDF tab export; sample-based or amp-sim voices; MIDI input from a controller; dyad-aware chord symbols on the tab; mobile layout; collaborative sharing; local LLM option for the AI layer.

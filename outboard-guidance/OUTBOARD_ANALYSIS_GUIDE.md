# Outboard analysis guide: turning a riff recording into RIFF-SPACED riff JSON

This document is for another program or language model. It explains how to listen to (or
otherwise analyze) a recording of a guitar riff and write the result as a `*.riff.json` file
that RIFF-SPACED can open, validate and play back. Everything RIFF-SPACED needs is in this
folder:

- `OUTBOARD_ANALYSIS_GUIDE.md` (this file): the procedure and the rules.
- `riff.schema.json`: the formal JSON Schema (draft 2020-12). Validate your output against it.
- `example.riff.json`: a complete, valid example of a four-bar riff transcribed from audio.

Deliver the finished files into the repo folder `injest-riff-JSON/`. The owner runs
`python -m riffspaced.check_riffs ../injest-riff-JSON` from `backend/` to validate them and
then opens them in the app with File > Open.

## 1. What the music is

The owner plays heavy, low-tuned, chromatic riffs: sludge, doom and power metal with a
blues-turnaround feel. Expect:

- a six-string guitar in **Bb Standard** (open strings Bb1 Eb2 Ab2 Db3 F3 Bb3) unless told
  otherwise, through heavy distortion and fuzz;
- mostly **dyads** (two notes at once): power chords (a fifth), inverted power chords (a
  fourth, root on top), minor and major thirds, tritones and minor seconds, nearly always on
  the lowest three strings and sometimes the fourth;
- a lot of **palm muting**: short, percussive, damped notes;
- the classic **blues turnaround**: one note held while the other walks down in half steps;
- dissonance that is intentional. Transcribe what was played. Do not "correct" a clash to a
  consonance, do not resolve a line the player left open, and do not snap pitches to a key.

## 2. The target format in one paragraph

A riff is a loop of 4, 8, 12 or 16 bars of 4/4 at one tempo on one tuning. Each note is a
position on the fretboard (`string`, `fret`), a start time and a duration in **ticks** at
**480 ticks per quarter note** (1920 per bar), a velocity 1 to 127, a list of techniques and
an optional `chordId` that groups the notes of a dyad or chord. Notes with the same
`chordId` must have the same `start`. Imported notes also carry `confidence` (0 to 1).

## 3. Conventions you must follow

### Strings and pitches

- `tuning.pitches` lists the **open-string MIDI numbers low to high**. Bb Standard is
  `[34, 39, 44, 49, 53, 58]`.
- Notes use **guitarist numbering**: string 1 is the highest (thinnest), string 6 the lowest.
- The sounding MIDI pitch of a note is `pitches[N - string] + fret` where N is the number of
  strings. Example: string 6, fret 3 in Bb Standard is `34 + 3 = 37`, Db2.
- MIDI from frequency: `midi = 69 + 12 * log2(f / 440)`. Round to the nearest integer. Bb1 is
  58.27 Hz, Eb2 77.78 Hz, Ab2 103.83 Hz, Db3 138.59 Hz.
- Flats are the house spelling (Bb, Eb, Ab, Db, Gb), but the file stores MIDI numbers, so the
  spelling only matters in `name` and free text.

Fret table for the four low strings of Bb Standard (fret 0 to 12):

| String | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 (34) | Bb1 | B1 | C2 | Db2 | D2 | Eb2 | E2 | F2 | Gb2 | G2 | Ab2 | A2 | Bb2 |
| 5 (39) | Eb2 | E2 | F2 | Gb2 | G2 | Ab2 | A2 | Bb2 | B2 | C3 | Db3 | D3 | Eb3 |
| 4 (44) | Ab2 | A2 | Bb2 | B2 | C3 | Db3 | D3 | Eb3 | E3 | F3 | Gb3 | G3 | Ab3 |
| 3 (49) | Db3 | D3 | Eb3 | E3 | F3 | Gb3 | G3 | Ab3 | A3 | Bb3 | B3 | C4 | Db4 |

Other presets the app knows (same shape, lower or higher): E, Eb, D, C#, C, B, Bb and A
Standard, and the Drop tunings (lowest string down a whole step: Drop Ab is
`[32, 39, 44, 49, 53, 58]`). A custom tuning is fine as long as `pitches` has 6 to 8
strictly ascending integers between 20 and 70.

### Choosing a fingering for a pitch

A pitch can be played in several places. Pick the position the owner would use:

1. Prefer the **lowest strings** (6, then 5, then 4; 3 only when the music clearly sits
   there). Stay within frets 0 to 12 unless the pitch is impossible lower.
2. Inside one chord the fretted notes may span **at most 4 frets** (open strings do not
   count toward the span), and each note needs its own string.
3. Between consecutive chords, prefer the position that **moves the hand least**.
4. A power chord in this tuning is fret F on string 6 and fret F + 2 on string 5 (the strings
   are a fourth apart, so the same fret on two adjacent strings is a **fourth**, not a fifth).
   The inverted power chord (fourth, root on top) is the same fret on two adjacent strings.
5. If a pitch is unreachable on the tuning, keep the note at the nearest position and set
   `"unplayable": true` rather than dropping it.

### Time

- Detect the tempo in beats per minute and write it in `tempo.bpm` (a number, 30 to 300).
  If the riff is eighth notes at a fast tempo and you are unsure whether it is 160 or 80 BPM,
  choose the slower reading; the owner can double it in the app.
- Ticks from seconds: `ticks = seconds * bpm * 8` (because 480 / 60 = 8). Measure from the
  first downbeat of the riff, not from the start of the file. Leave out a count-in or pick
  noise before the first downbeat.
- Quantize `start` and `duration` to the **sixteenth grid (120 ticks)**, or to the
  eighth-triplet grid (160) or sixteenth-triplet grid (80) when the feel is clearly a
  triplet. Minimum `duration` is 1 tick; palm-muted eighths are usually written as the full
  240 with the `palmMute` technique, not as a shorter note.
- `lengthBars` is the loop length rounded **up** to 4, 8, 12 or 16. The riff may contain
  silence at the end. Notes must not run past `lengthBars * 1920` ticks.
- `timeSignature` is always `{ "beats": 4, "unit": 4 }` and `ppq` is always 480 in v1.
- `sections` must cover the bars exactly without overlap. One section is enough:
  `[{ "id": "main", "label": "A", "startBar": 0, "lengthBars": <lengthBars>, "kind": "main" }]`.
  Use `"kind": "turnaround"` for a bar range that is the walkdown if you want to mark it.

### Dyads and chords

- Two or more notes struck together get the same `chordId` (any short unique string such
  as `c01`) and exactly the same `start`. Different attacks never share a `chordId`.
- A held note under a moving line is **one long note**, not a repeated note per step. In
  the example, the Ab2 in bar 4 lasts a whole bar while the low string walks Eb D Db C.
- Octaves, unisons and single notes are fine; a single note has no `chordId`.

### Techniques

`techniques` is an array of strings from: `palmMute`, `letRing`, `slideUp`, `slideDown`,
`bend`, `hammerOn`, `pullOff`, `vibrato`, `dead`, `harmonic`, `tremolo`. Each appears at
most once per note. The ones that matter most for this music:

- `palmMute`: the note decays fast (gone within about 150 ms) and sounds percussive. In the
  owner's playing most chugs are palm muted; a bar of ringing eighths is the exception.
- `letRing`: a note that sustains into the next attack on purpose.
- `dead`: a fully choked, pitchless hit. Give it the string it was played on and fret 0.

### Velocity and confidence

- `velocity`: 1 to 127 from the attack level; 100 is a normal hit, 60 a ghosted one.
- `confidence`: your certainty that the note (pitch and timing) is right, 0 to 1. Below 0.6
  is drawn amber in the app; below 0.5 the AI cleanup pass is allowed to delete it. Be
  honest here: a low number is useful, a false 1.0 is not.

### Identity and provenance

- `id`: a UUID v4 for the riff. Note ids and chord ids are any non-empty strings unique in
  the file (`n001`, `c01`).
- `name`: the recording's file name without extension unless told otherwise.
- `createdAt`, `updatedAt`: ISO 8601 UTC, like `2026-10-25T12:00:00Z`.
- `source`: `{ "type": "audio", "audioFile": "<file name>", "analysisVersion":
  "outboard/<your tool and version>", "bpmDetected": <bpm before any rounding> }`. The
  `analysisVersion` string is how the owner later tells outboard results apart from the
  built-in analyzer (`0.6.0`) when comparing them.
- `tags`: include `"imported"` and `"outboard"`.
- `format` is exactly `"riff-spaced/riff"` and `version` is the integer `1`.

## 4. The procedure

1. **Load** the recording as mono. Note its length. Find the first real downbeat.
2. **Tempo**: estimate BPM from the attacks (palm-muted chugs give very clean onsets). Check
   the bar count makes musical sense: a four-bar riff at 92 BPM lasts about 10.4 s.
3. **Onsets**: list every attack time. Two strings struck together are one attack.
4. **Pitches per attack**: for each attack, decide how many notes sound (usually 1 or 2) and
   their MIDI pitches. Under distortion the fundamental can be weaker than its harmonics,
   and two notes create extra tones at their sum and difference frequencies; do not report
   those as a third note. If a tool only gives you one pitch per frame, consider whether a
   fifth or fourth above it is also present.
5. **Sustain**: for each note, find where it stops (muted, or replaced by the next note on
   the same string). A note that keeps ringing under later attacks is one long note.
6. **Fingering**: map each pitch to (string, fret) with the rules in section 3; map a dyad's
   two pitches together so they fit one hand position.
7. **Quantize** to ticks on the grid, round the loop up to 4/8/12/16 bars, assign ids and
   `chordId`s, set `palmMute` where the decay is fast, set velocities and confidences.
8. **Validate** against `riff.schema.json`, then check the rules the schema cannot express:
   chord members share a start, sections cover the loop exactly, strings fit the tuning,
   no note runs past the end.
9. **Write** `<name>.riff.json` (UTF-8, two-space indent) into `injest-riff-JSON/`. One riff
   per file. If you transcribe several takes of the same riff, name them `<name>-take2`.

If you cannot produce the full JSON, the next best delivery is a note list the owner can
convert: one line per note, `start_seconds, duration_seconds, midi_pitch, chord_group,
palm_mute(0/1), confidence`, plus the BPM and the tuning on a header line. State clearly
which format you delivered.

## 5. Common mistakes

- Writing the same fret on strings 6 and 5 and calling it a power chord. It is a fourth.
- Numbering strings from the low side (string 1 as the lowest). String 1 is the highest.
- Writing `start` in seconds or in milliseconds instead of ticks.
- Giving a held note one entry per beat.
- Dropping `velocity` and `techniques`: optional, but the app's playback is much closer to
  the recording with palm mutes marked.
- "Fixing" a tritone, a minor second or an unresolved walkdown. They are the music.
- A `chordId` whose notes have different `start` values (the file is rejected).
- `lengthBars` not in 4, 8, 12, 16, or sections that do not add up to it (rejected).

## 6. Minimal valid riff

```json
{
  "format": "riff-spaced/riff",
  "version": 1,
  "id": "7f3c2a1e-1111-4a2b-9c3d-000000000001",
  "name": "Minimal chug",
  "createdAt": "2026-10-25T12:00:00Z",
  "updatedAt": "2026-10-25T12:00:00Z",
  "tuning": { "name": "Bb Standard", "pitches": [34, 39, 44, 49, 53, 58] },
  "tempo": { "bpm": 92 },
  "timeSignature": { "beats": 4, "unit": 4 },
  "ppq": 480,
  "lengthBars": 4,
  "sections": [{ "id": "main", "label": "A", "startBar": 0, "lengthBars": 4, "kind": "main" }],
  "notes": [
    { "id": "n001", "string": 6, "fret": 3, "start": 0, "duration": 240, "velocity": 100,
      "techniques": ["palmMute"], "chordId": "c01", "confidence": 0.9 },
    { "id": "n002", "string": 5, "fret": 5, "start": 0, "duration": 240, "velocity": 100,
      "techniques": ["palmMute"], "chordId": "c01", "confidence": 0.9 }
  ],
  "tags": ["imported", "outboard"],
  "source": { "type": "audio", "audioFile": "chug.wav", "analysisVersion": "outboard/your-tool 1.0", "bpmDetected": 92.4 }
}
```

`example.riff.json` in this folder is the full four-bar walkdown: three bars of palm-muted
Db power chords, each bar ending on the inverted fourth, then the turnaround with Ab2 held
for a bar under the Eb D Db C walk to the open Bb1. Read it alongside this guide.

# Phase 1: Music core

Goal: every musical and structural rule in SPEC sections 3 and 4 exists as tested, pure code in both TypeScript and Python, with shared fixtures that prevent drift. No UI yet beyond the Phase 0 placeholder.

Read first: SPEC sections 3, 4; DECISIONS 23 to 29.

## P1.T1 Shared conventions fixture

Steps:
1. Write `shared/fixtures/music-conventions.json` with these arrays, each an input/expected pair list:
   - `pitchNames`: for midi 34, 39, 44, 49, 53, 58, 60, 69, 70, 71: flats and sharps names with octave (`"Bb1"`, `"A#1"`, ...).
   - `frequencies`: midi 69 → 440.0, 57 → 220.0, 34 → 58.2705 (4 decimals).
   - `tunings`: every preset from SPEC 3.3 with name and pitches, plus the rule "drop = standard with pitches[0] - 2".
   - `pitchOf`: cases for Bb Standard: (string 6, fret 0) → 34, (6, 3) → 37, (5, 3) → 42, (4, 5) → 49, (1, 12) → 70.
   - `ticks`: ppq 480, bar = 1920, sixteenth = 120, eighth triplet = 160, sixteenth triplet = 80; `ticksToSeconds(1920, 120)` = 2.0.
   - `dyads`: pairs (37, 44) → P5 lowerIsRoot true root Db; (42, 37) → P4 inverted, root Db (upper note is root in a P4); (37, 40) → m3; (37, 43) → TT; (37, 38) → m2.
   - `fingerings`: `findFingerings(37, BbStandard, {frets 0..12, strings 6,5,4,3})` → [[6,3]] only (42 on string 5 would need fret -2; 37 on string 5 is impossible). `findFingerings(49, ...)` → [[4,5],[5,10],[3,0]].
2. This file is the contract. Both implementations load it in tests.

Commit: `test(music): add shared music-conventions fixture as the cross-language contract`.

## P1.T2 TypeScript music module

Files under `frontend/src/music/`: `pitch.ts`, `naming.ts`, `tuning.ts`, `time.ts`, `dyad.ts`, `fingering.ts`, `index.ts`, each with a `*.test.ts`.

Requirements:
- `pitch.ts`: `freqOf(midi)`, `pitchClass(midi)`, `octaveOf(midi)`.
- `naming.ts`: `FLAT_NAMES`, `SHARP_NAMES`, `nameOf(midi, accidentals, withOctave)`, `type Accidentals = 'flats' | 'sharps'`.
- `tuning.ts`: `type Tuning = { name: string; pitches: number[] }`, `STANDARD_PRESETS`, `dropOf(standard)`, `DROP_PRESETS` (generated), `ALL_PRESETS`, `pitchOf(tuning, string, fret)`, `isValidTuning`, `retuneString(tuning, string, semitones)`.
- `time.ts`: `PPQ = 480`, `TICKS_PER_BAR`, `GRID` map, `ticksToSeconds`, `secondsToTicks`, `barBeatTick(ticks)` → `{bar, beat, tick}` 1-based, `snapToGrid(ticks, grid)`.
- `dyad.ts`: `describeDyad(a, b)` per SPEC 3.5.
- `fingering.ts`: `findFingerings`, `bestFingering` per SPEC 3.6, deterministic tie-breaking, exported `handSpan(positions)`.
- Tests load `@shared/fixtures/music-conventions.json` and iterate every case, plus edge cases (negative frets rejected, tuning validation, span > 4 rejected).

Commit: `feat(music): implement pitch, naming, tuning, time, dyad, and fingering modules with fixture tests`.

## P1.T3 Document types, schemas, validation, migration (TypeScript)

Files: `frontend/src/model/types.ts` (Riff, Note, Section, Arrangement, Song, LibraryBundle, with JSDoc on every field copied from SPEC 4), `frontend/src/model/validate.ts`, `frontend/src/model/migrate.ts`, `frontend/src/model/factories.ts` (`newRiff(tuning?)`, `newNote(...)`, `newArrangement`, `newSong`, `newLibrary`), `frontend/src/model/ids.ts` (`uuid()` wrapper so tests can stub it).

`shared/schema/riff.schema.json`, `arrangement.schema.json`, `song.schema.json`, `library.schema.json` (draft 2020-12), written by hand to match SPEC 4 exactly, including enums for techniques and section kinds, min/max for string, fret, velocity, confidence, and `required` lists.

`validate.ts` is hand-written (DECISIONS 17): checks `format`, `version`, required fields, types and ranges, `chordId` groups share `start`, sections cover `0..lengthBars` without overlap, `notes[].string` within `tuning.pitches.length`. Returns `{ ok: true, value } | { ok: false, errors: string[] }` with human-readable messages (`notes[3].fret must be an integer between 0 and 24`).

`migrate.ts`: `migrateRiff(doc)` with a `switch (doc.version)` that currently only handles 1; tests include a fixture for a hypothetical v0 shape to prove the mechanism works (`shared/fixtures/legacy/riff-v0.json`, which lacks `sections` and uses `bars`).

Tests: valid fixtures pass; each rule has a failing fixture; error messages are asserted.

Commit: `feat(model): add riff, arrangement, song types with JSON schemas, validation, and migration`.

## P1.T4 Demo library fixture

Write `shared/fixtures/demo-library.json`, a valid library bundle with:
1. **"Walkdown Turnaround"**: Bb Standard, 92 BPM, 4 bars, one `main` section. Bars 1 to 3: palm-muted eighth-note P5 dyads on strings 6 and 5 at fret 3 (Db2 + Ab2), with an inverted P4 on the "and" of beat 4 each bar (string 6 fret 5, string 5 fret 3). Bar 4 is the owner's signature turnaround: string 5 holds fret 3 (Ab2) as whole-bar sustained `letRing`, while string 6 walks down chromatically in palm-muted eighths: fret 5, 5, 4, 4, 3, 3, 2, 2 (F2, E2, Eb2, D2), resolving to an open-string Bb1 chug on the downbeat of the loop. Tags `sludge, turnaround, palm-mute, demo`.
2. **"Tritone Chug"**: Bb Standard, 80 BPM, 4 bars: sixteenth-note palm-muted single notes on string 6 fret 0 with a tritone dyad (string 6 fret 1 + string 5 fret 2, that is B1 + Bb2... recompute: string 5 fret 2 = 41 = F2, string 6 fret 1 = 35 = B1, interval 6 = TT) landing on beat 3 of bars 2 and 4, left unresolved. Tags `doom, tritone, demo`.
3. One arrangement "Demo verse": Walkdown x3 then Tritone x1. One song "Demo song" with that arrangement as its only part.

Every note must validate; add a test that loads the fixture through `validate.ts` and also computes that every note is playable within frets 0 to 12 on the lowest four strings. Also compute and assert the dyad labels for a few chords (P5, P4, TT) so the fixture doubles as a worked example.

Commit: `feat(fixtures): add demo library with the Bb walkdown turnaround and tritone chug riffs`.

## P1.T5 Python mirror of the music module and schemas

Files under `backend/riffspaced/music/`: `pitch.py`, `naming.py`, `tuning.py`, `time.py`, `dyad.py`, `fingering.py`, mirroring the TypeScript API names in snake_case. `backend/riffspaced/model/`: `types.py` (dataclasses + `from_dict`/`to_dict`), `validate.py` using `jsonschema` against `shared/schema/*.json` plus the semantic checks (chordId start, sections coverage) that JSON Schema cannot express, `migrate.py`.

Tests under `backend/tests/` load the same `shared/fixtures/music-conventions.json`, the demo library, and the legacy fixture. Add `test_fixture_parity.py` that asserts the number of fixture cases consumed equals the number in the file so neither side silently skips a section.

Commit: `feat(backend): mirror music core and document model in Python against the shared fixtures`.

## P1.T6 Docs and phase exit

1. `docs/MUSIC_MODEL.md`: a readable explanation of strings vs pitch arrays, ticks, the dyad table, and the fingering search, with the walkdown riff as the running example (ASCII tab of it included).
2. `docs/LEARNING_LOG.md` Phase 1 entry: "Why a shared fixture beats two test suites".
3. `STATUS.md`, tag `v0.1.0`, push, CI green, `/compact`.

Exit gate: `npm run check` and `make check` green; fixture parity test passes; tag pushed.

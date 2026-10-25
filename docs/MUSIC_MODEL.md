# The music model

How RIFF-SPACED represents pitch, strings, time, dyads, and fingerings. The same rules are implemented twice, in `frontend/src/music/` (TypeScript) and `backend/riffspaced/music/` (Python), and both are tested against `shared/fixtures/music-conventions.json`. The running example is the demo riff "Walkdown Turnaround".

## The running example

Bb Standard tuning, 92 BPM, 4 bars. String 6 is the lowest string, written at the bottom, as in printed tab.

```
Walkdown Turnaround   Bb Standard   92 BPM
      bar 1               bar 2               bar 3               bar 4
Bb3|-----------------|-----------------|-----------------|-----------------|
F3 |-----------------|-----------------|-----------------|-----------------|
Db3|---------------5-|---------------5-|---------------5-|-----------------|
Ab2|--5-5-5-5-5-5-5--|5-5-5-5-5-5-5-5--|5-5-5-5-5-5-5-5--|5----------------|
Eb2|-----------------|-----------------|-----------------|-----------------|
Bb1|0-3-3-3-3-3-3----|3-3-3-3-3-3-3----|3-3-3-3-3-3-3----|5-5-4-4-3-3-2-2--|
     p p p p p p p p   p p p p p p p p   p p p p p p p p   p p p p p p p p
```

Bars 1 to 3 are palm-muted eighth-note power chords, Db2 + Ab2, played at fret 3 on string 6 and fret 5 on string 5. The last eighth of each bar flips the chord upside down: Ab2 + Db3 at fret 5 on strings 5 and 4, a fourth with the root on top. Bar 4 is the turnaround: Ab2 rings for the whole bar while the low string walks down a half step at a time, Eb, D, Db, C, landing on the open Bb1 that starts the loop again.

## Strings versus pitch arrays

Two conventions meet here and the code keeps both on purpose.

- Guitarists number strings from the top: string 1 is the thinnest and highest, string 6 the thickest and lowest. Riff notes store `string` this way because that is how a player thinks and how tab is written.
- Tunings store their open-string pitches low to high, `pitches[0]` being the lowest string, because that is how DAWs, MIDI, and arithmetic prefer it.

The bridge is one formula, implemented as `pitchOf` and `pitch_of`:

```
pitchOf(string, fret) = pitches[N - string] + fret        (N = number of strings)
```

For Bb Standard, `pitches = [34, 39, 44, 49, 53, 58]` (Bb1 Eb2 Ab2 Db3 F3 Bb3). String 6 fret 3 is `pitches[0] + 3 = 37`, Db2. String 5 fret 5 is `pitches[1] + 5 = 44`, Ab2.

A trap worth knowing: in standard-style tunings adjacent low strings are a perfect fourth (5 semitones) apart, so the same fret on strings 6 and 5 is a fourth, not a fifth. The power-chord fifth sits two frets higher on the next string. The original plan for this project got that wrong and the fixture caught it before any code was written.

Drop tunings are generated, not typed: `dropOf(standard)` lowers `pitches[0]` by 2. Bb Standard dropped is Drop Ab.

## Pitch and names

MIDI numbers everywhere. C4 = 60, A4 = 69 = 440 Hz, `freq(m) = 440 * 2^((m - 69) / 12)`. Bb1 is 34 and sounds at 58.27 Hz, which matters later for the analysis window length.

Flats are the default spelling (Bb, Eb, Ab, Db) because that is the owner's harmonic world; sharps are a toggle. Octave numbers follow the scientific convention: `floor(m / 12) - 1`.

## Time in ticks

480 ticks per quarter note, integers only in stored data. One 4/4 bar is 1920 ticks, an eighth is 240, a sixteenth 120, and the triplet grids are 160 and 80. Seconds appear only at the audio boundary: `seconds = ticks / 480 * 60 / bpm`. The position readout is 1-based, `bar.beat.tick`, so tick 2520 reads `02.2.120`.

## Dyads

A dyad is two notes sharing a `chordId`. `describeDyad(a, b)` reduces the distance to one octave and labels it:

| Semitones | Label | In this music |
|---|---|---|
| 0 | P1 or P8 | unison or octave dyad |
| 1 | m2 | chromatic clash |
| 3 | m3 | minor dyad |
| 4 | M3 | major dyad |
| 5 | P4 | inverted power chord, root on top |
| 6 | TT | tritone |
| 7 | P5 | power chord |

The root rule is the one place the labels carry an opinion: for a P5 the root is the lower note, for a P4 the root is the upper note (a fourth is a fifth turned over), and for everything else the lower note is the root by default. In the example, Db2 + Ab2 is `P5, root Db` and Ab2 + Db3 is `P4, inverted, root Db`: the same chord two ways, which is exactly what the owner means by "often inverted so the root is not the lowest note".

## Fingering search

`findFingerings(pitch, tuning, options)` lists every (string, fret) that produces a pitch within a fret range (default 0 to 12) on the allowed strings (default the lowest four), lowest string first. Db3 (49) in Bb Standard is at 5:10, 4:5, and 3:0.

`bestFingering(pitches, tuning, previous)` chooses one position per note for a group that sounds together. Every pitch must land on its own string and the fretted span may not exceed 4 frets (open strings do not count toward the span). Among the playable shapes, the lowest cost wins:

| Term | Weight | Why |
|---|---|---|
| span between fretted fingers | 1.0 per fret | stretches are hard |
| hand movement from the previous shape | 1.0 per fret | riffs stay in one place |
| string height | 0.5 per string above the lowest, per note | the owner lives on the low strings |
| above the lowest three strings | 2.5 extra per note | the fourth string is occasional, the third rare |
| hand position | 0.3 per fret | riffs live near the nut |
| skipped string inside the shape | 2.0 each | shapes are compact |

The hand position is the lowest fretted finger (0 when everything is open). Ties break toward the lower-pitched string, then the lower fret, so the result is deterministic.

Worked cases from the fixture:

- Db2 + Ab2 picks 6:3 + 5:5 over 6:3 + 4:0. The open-string version has span 0 but skips string 5 and sits one string higher.
- Ab2 + Db3 picks 5:5 + 4:5 over 6:10 + 5:10 (too high up the neck) and over the open 4:0 + 3:0 (string 3 costs extra).
- A lone Db3 picks 4:5. With the hand already at fret 10 it picks 5:10 instead: movement outweighs height.

These weights were tuned against the fixture, not the other way round, and the fixture file documents them. The Phase 6 analysis uses the same cost shape as the transition cost of its Viterbi decoder, which is why the two agree about what "the way the owner plays" means.

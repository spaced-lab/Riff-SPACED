# Phase 9: Scale mode

Owner request 2026-10-25, after v1 closed. Goal: a scale overlay on the fretboard so the neck
shows where a scale lives in the current tuning, with each scale degree in its own color and a
legend that doubles as the toggle panel.

Read first: SPEC 5.3 (fretboard layers), DECISIONS 6 (letters inside dots), docs/FRETBOARD.md.

## P9.T1 Scale definitions (pure)

- `music/scales.ts`: the eight scales as interval sets from the root, in menu order: Minor
  Pentatonic, Blues (minor pentatonic plus the b5, right next to it), Major Pentatonic, Major
  (Ionian), Natural Minor (Aeolian), Dorian, Mixolydian, Harmonic Minor.
- Every scale note carries a degree (1..7, or `blue` for the b5 of the blues scale) and whether
  it is flat or natural against the major scale, so the overlay can color b3 and 3, b7 and 7,
  b6 and 6 differently.
- `degreesOf(scale, root)` maps pitch class to degree; `degreeLabel` names it (R, b3, 4, b5...).
- Six color groups for the toggles: roots, thirds, fifths, sevenths, blue notes, others (2, 4, 6).

Tests: every scale has distinct pitch classes, the blues scale is the minor pentatonic plus one
blue note, the degrees of C major are the white keys, labels for A minor pentatonic.

## P9.T2 Store slice and preferences

`store/scaleSlice.ts`: mode (`off`, `color`, `mono`), scale id, root (null means follow the
lowest open string of the current tuning), one boolean per color group (all on by default).
Persisted with the other view preferences in `riffspaced.prefs.v1`.

## P9.T3 Overlay, legend, menu

- `fretboard/ScaleDots.tsx`: a layer under the riff notes with one small dot per (string,
  fret) whose pitch class is in the scale. Color mode fills the dot in its degree's color when
  that group is on, otherwise draws the plain ring. Mono draws the plain ring everywhere.
- `fretboard/ScaleLegend.tsx`: scale name and root, one swatch per degree in the scale; a swatch
  is a button that toggles its group. Shown above the fretboard whenever the mode is not off.
- New top-level menu Scales between Tuning and Playback: Off / Full color / Mono, Scale
  submenu, Root submenu (twelve roots, spelled with the current accidentals, plus "follow
  tuning"), then the six color toggles.
- Split view carries the overlay too. The hover tooltip names the degree.

Tests: Fretboard render test for the overlay (count, classes, mono), legend toggles, menu
items present, slice defaults. e2e `scales.spec.ts` with screenshots in
docs/screenshots/phase-09/.

## P9.T4 Docs and exit

docs/FRETBOARD.md (new layer and the color table), docs/USER_GUIDE.md (a Scales section),
LEARNING_LOG entry, DECISIONS entry for the color mapping, STATUS.md, tag v0.9.0.

Chrome verification script: open http://localhost:5173, Scales > Full color, Scales > Scale >
Blues, Scales > Root > Eb; expect pink roots, blue b5 dots, purple fifths, teal b7 dots, the
legend above the neck; click the roots swatch and expect roots to turn plain; Scales > Mono;
Scales > Off; console clean.

## P9.T5 CAGED positions (owner request, same day)

Once the scale overlay is in: a position mode that highlights the scale notes in one hand
position and dims the rest, so the five shapes and how they chain up the neck can be learned
one at a time.

- `music/positions.ts`: `positionsOf(scale, root, tuning, fretCount)` returns the hand
  positions in neck order. A position starts at each scale note on the lowest string and
  spans four frets (five when a scale degree would otherwise be skipped on some string); it
  carries a name. For scales with a root on the lowest string the names follow CAGED, the
  common method: the position whose root sits under the first finger is the E shape, then D,
  C, A, G as the hand moves up. Positions are listed from the nut up.
- Store: `scalePosition: number | null` (null means the whole neck). Scales menu gets a
  Position submenu (Whole neck, then each named position) and "Position up / down" items;
  the legend shows the position name with up and down buttons.
- Overlay: scale dots outside the active position are drawn dimmed; those inside stay at
  normal brightness. Riff notes are unaffected.

Tests: the minor pentatonic in any tuning gives five positions whose union is every scale note
on the neck; adjacent positions overlap on one fret column; names cycle E D C A G starting
from the position with the root under the first finger. e2e: step through positions, screenshot.

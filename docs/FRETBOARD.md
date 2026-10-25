# The fretboard

How the SVG fretboard in `frontend/src/fretboard/` maps strings and frets to pixels, why it is SVG, and how a dot decides what it looks like.

![Walkdown Turnaround with note letters](screenshots/phase-02/app-letters.png)

## Why SVG

The fretboard is a drawing of a few hundred simple shapes: lines for wires and strings, circles for markers and notes, text for numbers and letters. SVG fits that exactly. Every element is a DOM node, so it can be inspected in devtools, found by a test (`[data-note-id]`, `[data-cell]`), styled by the theme file, and given its own click handler. It stays crisp at any zoom. Canvas would be faster for thousands of moving shapes, but nothing here moves except the sounding dots, and they are a handful.

The one performance rule, which matters more in the tab lanes than here, is that the playhead is moved by writing to a ref each animation frame rather than re-rendering React. The fretboard itself only re-renders when the set of notes, the selection, or the highlighted set changes, and the store skips highlight updates when the set is unchanged.

## Geometry

`geometry.ts` is a pure function from a pixel box to coordinates. Given a width, a height, a fret range, a string count, and whether spacing is realistic, `layout()` returns:

- `fretX(fret)`: the x of a fret wire. Even spacing divides the neck width by the number of frets in range. Realistic spacing uses the real-neck rule, each fret 2^(-1/12) = 0.944 of the previous one, with the distances normalized so the requested range still fills the width.
- `noteX(fret)`: the center of the space ending at that wire. The open string sits just left of the nut, at `nutX - 1.4 * dotRadius`.
- `stringY(string)`: string 1 at the top, string N at the bottom, equal gaps. This matches printed tab and the tab lanes below the fretboard.
- `dotRadius`: `min(0.42 * stringGap, 0.38 * narrowestFret)`, never below 3 px, so dots fit both the string spacing and the narrowest fret in a realistic 0-24 view.
- `markers`: the frets with position dots (3, 5, 7, 9, 15, 17, 19, 21 single; 12 and 24 double), only those inside the range.

The component measures its container with a `ResizeObserver` and passes the size in, so the same math serves the main view, the four-way split, and the small previews on AI suggestion cards.

## Layers, bottom to top

1. Fret numbers above the neck (marker frets brighter).
2. Position markers between the wires.
3. Fret wires; the nut is a thicker bright line when the range starts at 0.
4. Strings, thicker toward the low side, with the open-string names in the left gutter.
5. One transparent hit rectangle per (string, fret) cell. This is what makes empty neck clickable: SVG lines are one pixel wide, rectangles are not.
6. Chord connectors: a thin line between notes that share a `chordId`, the fingering hint for a dyad.
7. Note dots, last so they sit on top and receive clicks first. A dot stops propagation so clicking a note is never also a click on its cell.

## The dot state machine

A dot is a `<g>` with a circle and an optional letter. Its appearance is a set of CSS classes, decided in `FretboardNote.tsx` and styled only in `fretboard.css`:

| Class | When | Look |
|---|---|---|
| (none) | a normal note | green fill |
| `fb-note--selected` | in the selection | green fill, white outline |
| `fb-note--sounding` | in `highlightIds` during playback | bright fill, scaled 1.25 for 80 ms |
| `fb-note--low` | `confidence` below 0.6 (audio import) | amber fill |
| `fb-note--unplayable` | flagged by transpose or retune | hollow amber outline |
| `fb-note--dimmed` | ghost context (other notes in the bar) | 35 percent opacity |

States combine: a selected, sounding note has both classes. Because the component never names a color, the CRT toggle in Phase 8 and any future theme restyle every state from one file.

Letters are drawn in black inside the dot using `nameOf(pitch, accidentals, false)`, so the flats and sharps toggle changes them with no component logic.

## Interaction surface

Everything leaves the component as a callback: `onCellClick({ string, fret, shiftKey })` from the hit rectangles, `onNoteClick(id, { shiftKey, button })` and `onNoteContextMenu(id)` from the dots. The store decides what those mean (Phase 3: add a note at the edit cursor, add to the chord with shift, select, delete). Hovering any cell or dot shows `string 6 fret 3 = Db2`.

## Trying it

The harness at `/#/dev/fretboard` shows four boards at once: Bb Standard with dots, the same with letters, E Standard 0-24 with realistic spacing and sharps, and a seven-string B Standard. The Playwright spec `e2e/fretboard.spec.ts` screenshots each one into `docs/screenshots/phase-02/`.

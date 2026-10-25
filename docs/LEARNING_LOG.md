# Learning log

One entry per phase. Each entry says what was built, names the key idea, and points at the three to six commits whose messages teach it best. Read a commit with `git show <hash>` and start with its LEARN section; the WHY, WHAT, and TEST sections tell you what changed and how it was proven.

## Phase 0: what a healthy repo skeleton looks like

Built: a public repo under spaced-lab, a Vite + React + TypeScript frontend with a theme and two test layers, a FastAPI backend with a health probe, a shared folder both sides read, CI running both gates, GitHub Pages deploying the frontend on every push, and Docker images with compose.

Key idea: gates before features. Every later commit in this repo runs `npm run check` or `make check` (or both) before it lands, and CI repeats them on GitHub. That only works if the gates exist before the first feature does, so Phase 0 builds nothing musical and everything mechanical. A skeleton that already lints, tests, builds, deploys, and containerizes means a feature commit is only ever about the feature.

Read these commits:

- `a9431fd` feat(frontend): the toolchain, the theme as CSS custom properties, and the e2e helper that turns "console must be clean" into a failing test.
- `de21236` feat(backend): the app factory, CORS from the environment, and why `.env` is a fallback rather than the source of truth.
- `b44362e` ci: both gates on GitHub, and the `base` path trap that breaks Vite apps on project Pages sites.
- `4299413` chore(shared): one fixture folder read by two languages is a contract, not test data.

## Phase 1: why a shared fixture beats two test suites

Built: the music conventions (pitch, names, tunings, ticks, dyads, fingering search) and the document model (riff, arrangement, song, library bundle with JSON Schemas, validation, migration) in both TypeScript and Python, a demo library with the owner's signature turnaround, and `docs/MUSIC_MODEL.md`.

Key idea: when two codebases must agree, give them one set of expected values to agree with. `shared/fixtures/music-conventions.json` holds every input/expected pair, both test suites iterate it, and a parity test on each side asserts the same case count, so a new section on one side fails the other until it catches up. Writing the expected values from the spec's formulas rather than from code found four fret arithmetic errors in the plan before a line of music code existed.

Read these commits:

- `55a4033` test(music): the fixture, and the fourth-versus-fifth mistake it caught.
- `3ba8766` feat(music): the TypeScript modules, and why the fingering cost model needed a new feature instead of new weights.
- `32416ef` feat(model): validation and migration as separate jobs with separate error vocabularies.
- `f26fa19` feat(fixtures): the demo riffs as a worked example that tests the model.
- `124fa2f` feat(backend): the Python mirror and the two parity tests that bind the sides together.

## Phase 2: a fretboard that is only a drawing

Built: the Zustand store with its single `commit` door, pure fretboard geometry, the SVG fretboard component with every visual state as a CSS class, a temporary toolbar, the layout shell with phase-labeled placeholders, a dev harness route, and `docs/FRETBOARD.md`.

Key idea: keep the component presentational. Coordinates come from a pure function, state comes in as props, and every interaction leaves as a callback. That is why the same component will serve the main view, the four-way split, and the AI preview cards, and why its tests can assert exact pixel positions without a browser.

Read these commits:

- `9ebf76f` feat(store): `commit(label, change)` as the one mutation path for undo and autosave.
- `46e5709` feat(fretboard): geometry as a pure function, realistic spacing normalized to any range.
- `19d6148` feat(fretboard): the component, hit rectangles for clickable neck, states as CSS classes.
- `db8d613` feat(fretboard): two bugs worth remembering: object-returning Zustand selectors and Testing Library cleanup with globals off.
- `4a55932` feat(app): the shell as a visible plan, and the stacked-dots hover lesson for Playwright.

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

## Phase 3: an editor is a state machine and one mutation door

Built: tab lanes with grid and zoom, note entry by click and keyboard with dyads, marquee / drag / resize / clipboard, sections and loop length with a themed confirm, undo and redo, localStorage autosave with quarantine of corrupt data, the note and dyad inspector, and `docs/EDITOR.md`.

Key idea: two disciplines made the editor small. Every riff change is a pure function wrapped by `commit`, so undo, autosave, and timestamps live in one place. And every pointer gesture is a named state (idle, marquee, dragging, resizing) that previews locally and commits once on release, so a drag is one undo step and the store never sees intermediate positions.

Read these commits:

- `0396e0b` feat(tab): the lanes, the non-passive wheel listener, and the playhead ref.
- `b5efdf9` feat(editor): keyboard handling as a pure function with injected timers.
- `aef6bb6` feat(editor): the pointer state machine and one-commit gestures.
- `6d8e23f` feat(editor): invalid section states made impossible by construction; the themed confirm.
- `a90199a` feat(store): undo/redo and autosave, and the quarantine rule (never destroy what you cannot read).
- `f3846f8` fix(store): the pipeline exit-code lesson, worth reading before trusting any `cmd | grep` gate.

## Phase 4: two clocks, one scheduler

Built: the lookahead scheduler with an injectable clock, the basic and heavy voices, the metronome, the master bus, the engine that binds them to the store and the animation frame, the transport, section solo, count-in, visual sync with a measured jitter readout, the four-way split view, the offline WAV render, and `docs/AUDIO_ENGINE.md`.

Key idea: the main thread's timers are jittery and the audio clock is exact, so a coarse timer schedules precise events a little ahead, and the visuals read the audio clock back. Counting in absolute ticks makes loop wraps seamless; a scheduled-key set makes edits during playback safe; injecting the clock makes the same scheduler run in tests, in the browser, and offline.

Read these commits:

- `63978f6` feat(audio): the scheduler and the fake clock that proves its timing to a microsecond.
- `7631d20` feat(audio): voices whose whole envelope is scheduled at noteOn, tested against a recording fake of Web Audio.
- `6733667` feat(playback): the engine, and why "I want to play" and "it is playing" are different fields.
- `169e8fc` feat(playback): visuals read the audio clock; two UI traps (overflow hides controls, a checkbox is not a text field).
- `a3e7b71` feat(audio): offline rendering by swapping the clock, and the WAV header by hand.

## Phase 5: files are the product

Built: the full menu bar with themed confirm, prompt, form and info dialogs and toasts, the library panel with search, tags, context menu and drag-append, arrangement and song editors over a flattened read-only timeline, open and save through the File System Access API with download and file-input fallbacks, library import with replace or keep-both merging, recents, ASCII tab export with golden files, a hand-written MIDI writer with a test reader, and `docs/FILE_FORMATS.md`.

Key idea: the formats were fixed in Phase 1 and never changed; everything in this phase is a way to move them. Arrangements reference riffs by id and are flattened on the fly, so there is one copy of every note. Open and save hide two different browser capabilities behind one interface. The exports are small enough to write by hand, and the tests for them (goldens for tab, a reader for MIDI) check the output means what it should, not just that it was produced.

Read these commits:

- `9a94a28` feat(menu): the menu as data, with unbuilt items disabled and labeled by phase.
- `06d099b` feat(library): delete cascades and the tuning check, where a library earns trust.
- `05c01e4` feat(arrangement): flattening as a memoized view, ids namespaced per repeat.
- `6432053` feat(storage): one interface over pickers and downloads; keep-both rewrites references.
- `08d1c46` feat(export): the golden that caught the author, not the code.
- `c8643d4` feat(export): variable-length quantities and running status, verified by a forty-line reader.

## Phase 6: search what the hands can play

Built: the whole analysis backend in numpy and scipy: loading and band-limiting, a Karplus-Strong plus tanh test synth for ground truth, STFT with interpolated peaks, spectral-flux onsets with a short timing window, tatum-based tempo, the fingering-constrained spectral template matcher, Viterbi decoding, quantization and emission, a benchmark harness with committed results, the ingest CLI, the analyze endpoints, the import dialog with health polling, and `docs/ANALYSIS_METHOD.md`.

Key idea: do not ask the signal which frequencies it contains; ask which of the few hundred shapes the owner's hands can play on this tuning it sounds most like. Templates carry harmonics, inharmonicity and the intermodulation tones distortion creates between two strings, so the fuzz that defeats pitch trackers becomes evidence. Two framing lessons mattered as much as the matcher: identify what is *new* in each slice and decide "still ringing" separately by evidence, and scale Viterbi emissions to the transition costs or the transitions become the decision. The benchmark that disagreed with the thresholds is in `docs/benchmarks/latest.md` and the gap is written down in the backlog with numbers.

Read these commits:

- `00c6346` feat(synth): the pick is the sound; a 1/f pluck and a sum tone that belongs to neither string.
- `af32e58` feat(analysis): the window that is right for pitch is wrong for time.
- `ce15533` feat(analysis): tempo is a convention; beats are binary multiples of the smallest note value.
- `c07289a` feat(analysis): the matcher, and why line width at the low end decided the tritone.
- `9e44b16` feat(analysis): novel spectra, evidence-based sustain, emission temperature; the parameter sweep in the commit message.
- `3d823bf` test(analysis): a benchmark earns its keep when it disagrees with you.

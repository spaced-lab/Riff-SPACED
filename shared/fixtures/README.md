# Shared fixtures

Test data both the TypeScript and Python implementations load, so one set of expectations drives two test suites.

- `music-conventions.json` (Phase 1): the cross-language contract for pitch names, frequencies, tuning presets, `pitchOf`, ticks, dyad labels, and fingering search. Each section is a list of input/expected pairs. Both test suites iterate every case, and a parity test asserts the number of cases consumed matches the file so neither side silently skips a section.
- `demo-library.json` (Phase 1): a valid library bundle with two demo riffs (the Bb Standard palm-muted blues turnaround walkdown and a tritone chug), one arrangement, and one song. The app loads it on first run so it never opens empty.
- `legacy/` (Phase 1): one fixture per old document version, used to test `migrate`.
- `golden/` (Phase 5 and 8): expected text tab and MusicXML output for the demo riffs.
- `bench/` (Phase 6): extra hand-written riffs for the synthetic analysis benchmark.

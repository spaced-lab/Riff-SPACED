# Phase 7: AI layer

Goal: Claude, via the official SDK in the Python backend, names the dyads, identifies the style, cleans up imported riffs, and proposes counter riffs, variations, simplifications, embellishments, fingerings and tunings, all honoring the owner's style directive verbatim. The frontend auditions suggestions through the same engine and never overwrites the owner's riff without a click.

Read first: SPEC 9 (all), 8.4 (`--ai`), 5.7 (AI menu); DECISIONS 20, 22.

HARD STOP check at the start: `ANTHROPIC_API_KEY` must be set in the environment or in `backend/.env`. If not, write the request into STATUS.md, commit, push, stop. The endpoints and tests below are built so that unit tests run with a mocked client regardless; only the live smoke test needs the key.

## P7.T1 Prompt files and client wrapper

- `riffspaced/ai/prompts/style_directive.md`: the owner's directive from SPEC 9.1, verbatim, with a `promptVersion: 1` header line.
- `riffspaced/ai/prompts/analyze.md`, `suggest.md`, `cleanup.md`: system prompts that embed the directive, the tuning table, the riff JSON schema (inlined from `shared/schema/riff.schema.json`), the dyad table from SPEC 3.5, and a strict "respond with JSON only matching this shape" contract with one example each. Each has a `promptVersion` header.
- `riffspaced/ai/client.py`: `AiClient` wrapping `anthropic.Anthropic()`, `complete_json(system, user, schema) -> dict` with: `max_tokens` 8000, temperature 0.7 for suggest and 0.2 for analyze/cleanup, response text stripped of code fences, `json.loads`, `jsonschema` validation, one retry appending the validation error, then `AiError`. Model from `RIFFSPACED_MODEL`. Logs token usage per call to the report.
- `riffspaced/ai/fake_client.py`: deterministic fake returning canned JSON for tests; selected when `RIFFSPACED_AI_FAKE=1`.

Tests: prompt files load and contain the directive; fake client path validates; a malformed first response triggers exactly one retry.

Commit: `feat(ai): add prompt files with the style directive and a validated JSON client wrapper`.

## P7.T2 Analyze endpoint

`POST /ai/analyze` per SPEC 9.2: builds the user message from the riff JSON plus precomputed facts the model should not have to re-derive (dyad intervals from `music.dyad`, pitch names, section labels), calls the client, returns the analysis. Post-process: ensure every `chordId` in the riff has a dyad entry (fill missing ones from `describe_dyad` with `source: "computed"`).

Tests (fake client): demo walkdown returns `turnaroundDetected: true`; every chord labeled; computed fallback kicks in when the fake omits one.

Commit: `feat(ai): add riff analysis endpoint with computed dyad fallback`.

## P7.T3 Suggest endpoint

`POST /ai/suggest` per SPEC 9.2 with `kind` and `count`. After the model responds: validate each suggested riff; run `bestFingering` in Python to repair `unplayable` notes or flag them; force the input tuning unless `kind = tunings`; set `source = { type: "ai", model, promptVersion, parentRiffId }`; cap total notes per suggestion at 400.

Prompt guidance per kind (write these into `suggest.md` as a table): `variation` keeps the rhythm and changes 2 to 6 notes with intentional chromatic tension; `counterRiff` plays against the original, often a sustained dyad against chugs or vice versa; `counterMelody` single notes on strings 4 and 3; `switchUp` changes the rhythm, keeps the pitches; `simplify` fewer notes, same feel, for practice; `embellish` adds slides, hammer-ons, passing tones; `newInStyle` a new 4-bar riff in the same tuning and feel; `fingerings` same pitches, different positions, explain the trade-off; `tunings` propose up to 3 tunings that make this easier and refinger.

Tests (fake client): each kind returns `count` valid riffs; an unplayable note in the fake response is repaired or flagged; tuning forced.

Commit: `feat(ai): add suggestion endpoint for variations, counter riffs, simplification, fingerings, and tunings`.

## P7.T4 Cleanup endpoint and ingest --ai

`POST /ai/cleanup`: takes an imported riff and its report; the model may only move notes within ±1 fret, merge or split events, change `palmMute`, or delete events with confidence below 0.5; every change must appear in `changes[]` with a reason; the backend enforces those limits and rejects out-of-bounds edits.

Wire `--ai` in `ingest.py` to run cleanup after analysis and write both the raw and cleaned riff.

Tests (fake client): an out-of-bounds change is rejected; `changes[]` is returned.

Commit: `feat(ai): add bounded cleanup pass for imported riffs and wire ingest --ai`.

## P7.T5 Live smoke test (needs the key)

`backend/tests/live/test_ai_live.py`, skipped unless `RIFFSPACED_LIVE=1`: analyze the demo walkdown (assert `turnaroundDetected` and at least one `P5` and one `P4`), request 2 variations (assert valid, playable, same tuning). Run it once, paste the model's style summary into `docs/AI_LAYER.md` as a worked example, with token counts.

Commit: `test(ai): add live smoke test and record a first analysis of the demo turnaround`.

## P7.T6 Frontend: AI menu and suggestions drawer

- `ai/AiMenu` items wired; disabled with reason when backend down or `aiConfigured` false.
- `ai/SuggestionsDrawer.tsx`: cards per SPEC 9.3 (name, rationale, playing notes, mini `Fretboard` preview, buttons Audition / Add as variation / Add as new riff / Discard). Audition plays the suggestion through the engine without changing the current riff (engine accepts a transient playable); the fretboard shows the suggestion while auditioning and returns after.
- `ai/AnalysisPanel.tsx`: dyad labels listed by chord with click-to-select, style summary, chromatic devices, turnaround flag; also writes dyad labels into the tab as small text above chord brackets (View toggle "Dyad labels").
- AI > Settings dialog: backend URL, model name (sent as a header override `X-Riffspaced-Model`, honored by the backend only if `RIFFSPACED_ALLOW_MODEL_OVERRIDE=1`).
- Every accept is one undo step.

Playwright with `page.route` mocks for the three endpoints: open AI > Analyze, assert labels appear; AI > Suggest variations, assert 2 cards; Audition toggles play state; Add as variation appends a section; undo removes it. Screenshots to `docs/screenshots/phase-07/`.

Commit: `feat(frontend): add AI analysis panel and suggestions drawer with audition and undoable accept`.

## P7.T7 Chrome verification and phase exit

Chrome verification script (backend with key running):
1. Open http://localhost:5173, load the walkdown. AI > Analyze riff. Screenshot. Expect dyad labels `P5`, `P4 (inv)`, a style summary mentioning chromatic descent or turnaround.
2. AI > Suggest variations (2). Cards appear. Click Audition on one; fretboard shows it; readout runs; click Stop.
3. Add as variation. A new section appears in the inspector; the tab grows. Ctrl/Cmd+Z removes it.
4. AI > Alternate tunings. Expect up to three cards each naming a tuning.
5. Remove the key from the backend env and restart it; AI menu disables with `ANTHROPIC_API_KEY not set`. Restore. Console clean.

Docs: `docs/AI_LAYER.md` (prompt design, the directive and why it is verbatim, the JSON contract, the repair step, the worked example). `docs/LEARNING_LOG.md` Phase 7 entry. `STATUS.md`, tag `v0.7.0`, push, CI green (CI uses the fake client), `/compact`.

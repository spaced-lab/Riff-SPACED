# The AI layer

How RIFF-SPACED asks Claude about a riff and what it does with the answer (Phase 7,
`backend/riffspaced/ai/`, SPEC 9). The audio never goes to the model (DECISIONS 22, 49): the
Python side produces symbolic note events, the model reasons over them, and the Python side
validates and repairs what comes back before the owner sees it.

## The parts

| Module | Job |
|---|---|
| `prompts/style_directive.md` | the owner's words, verbatim, `promptVersion: 1` |
| `prompts/analyze.md`, `suggest.md`, `cleanup.md` | one system prompt per operation, as templates |
| `prompting.py` | parses the version header, fills the templates from the sources of truth |
| `facts.py` | the arithmetic the backend does for the model: pitches, names, intervals, positions |
| `schemas.py` | JSON Schema for each answer shape, the suggestion kinds, the cleanup change kinds |
| `client.py` | `AiClient.complete_json`: parse, validate, one retry, `AiError`; the live SDK client; `make_client` |
| `fake_client.py` | scripted and generated answers for tests, CI and the e2e suite |
| `analyze.py`, `suggest.py`, `cleanup.py` | the three operations, each with its post-processing rules |

Configuration: `ANTHROPIC_API_KEY` (or `backend/.env`), `RIFFSPACED_MODEL` (default
`claude-sonnet-5-5`, DECISIONS 20), `RIFFSPACED_AI_FAKE=1` for the fake, and
`RIFFSPACED_ALLOW_MODEL_OVERRIDE=1` to honor the frontend's `X-Riffspaced-Model` header.
Without a key and without the fake, every `/ai/*` route answers
`503 {"reason": "ANTHROPIC_API_KEY not set"}` and the AI menu shows that text.

## The directive is verbatim, and why

SPEC 9.1 is the owner describing his own music. Every system prompt embeds it unchanged under
the heading "The owner's style directive (verbatim; it overrides your defaults)". A
paraphrase would be the author's reading of the owner, and the whole point of the layer is
that the model takes the owner's reading: dissonance is intentional, open lines stay open,
the turnaround feel stays inside the heavy style. A test compares the prompt file with the
paragraph in SPEC.md character for character, so the two cannot drift apart silently. The
`promptVersion` header changes only when the owner changes the words, and every riff the AI
produces records the version in `source.promptVersion`.

## Prompt design

The three prompts share a skeleton: who the model is (an analyst, a writer, a cleanup pass
inside this app), the directive, how riffs are written (string numbering, the pitch formula,
ticks, chordIds, techniques), the tuning table, the dyad table, what the user message
contains, the task, and the output contract with one example. The tuning table, the dyad
table and the riff schema are not pasted into the markdown: `prompting.py` fills
`{{TUNING_TABLE}}`, `{{DYAD_TABLE}}` and `{{RIFF_SCHEMA}}` from `music/tuning.py`,
`music/dyad.py` and `shared/schema/riff.schema.json` at load time (DECISIONS 56). The prompt
therefore describes exactly the format the validator enforces.

The user message is a JSON object, never prose: `{ "task", "riff", "facts", ... }`. The facts
(`facts.py`) are everything derivable from the riff: each note's pitch and name, each
chord's interval label, root and inversion from `describe_dyad`, bar positions, sections,
palm-mute counts. The model is told to trust that arithmetic and spend its effort on
judgment. Two consequences: the dyad labels cannot be wrong in the way a language model is
wrong (it is not asked to subtract pitches), and the answers are consistent from call to
call even though sampling cannot be tuned (current models reject `temperature`, DECISIONS
55). For suggestions, variety comes from the prompt: the N suggestions in one call must
differ in a way the model can name, and the request carries an `avoid` list of what was
already shown.

## The JSON contract and the repair step

The model is asked for one JSON object and nothing else. `AiClient.complete_json` then:

1. strips a code fence if the model added one anyway;
2. `json.loads` and insists on an object;
3. validates against the operation's schema (`schemas.py`);
4. runs the operation's own check (for suggest and cleanup: every riff in the answer passes
   `validate_riff`, schema plus the semantic rules);
5. on any problem, appends the model's answer and a user turn listing the problems, and asks
   once more;
6. on a second failure raises `AiError`, which the API turns into `502 {"reason": ...}`.

The retry is the whole error-handling story. There is no hand repair of malformed JSON and
no partial acceptance: a bad answer is quoted back once, then refused.

## What each operation enforces after validation

**Analyze.** Every two-note chord in the riff gets a label. Chords the model skipped are
filled from `describe_dyad` with `source: "computed"`; the model's own entries carry
`source: "model"`; a label for a chordId that is not in the riff is dropped with a warning.
The UI can always draw a label above every chord bracket and still show which came from the
model.

**Suggest.** Each suggested riff keeps the input tuning unless the kind is `tunings`. If the
model changed the tuning anyway, the pitches it meant are computed under its tuning and
refingered under the owner's, so the music survives and only the hand moves. Every
simultaneous group is checked for playability (distinct strings, span of four frets or less)
and repaired with `best_fingering` or flagged `unplayable`. Suggestions are capped at 400
notes, tagged `ai`, given a fresh id, and stamped
`source: { type: "ai", model, promptVersion, parentRiffId }`. Each repair is listed in
`repairs` so the drawer can say what the backend changed.

**Cleanup.** The result is rebuilt from the original riff by replaying only the declared
changes that pass their check: `moveFret` one fret on the same string, `merge` of two
same-string notes starting within a sixteenth, `split` into two notes covering the same
time, `palmMute` toggles, `delete` of notes under 0.5 confidence. Tuning, tempo, length,
sections and ids cannot change. Everything the model edited without declaring it, and
every declared change that failed its check, is reported in `rejected` and never lands.

## The fake client

`FakeAiClient` has two modes. Scripted: tests hand it the texts to return, which is how the
retry, the computed fallback, the out-of-bounds cleanup edits and the tuning restore are
exercised. Generated: it reads the request JSON and derives a plausible, schema-valid answer
from the riff with the same music helpers the backend uses (dyads from `describe_dyad`, a
chromatic-descent scan for the turnaround flag, nudged frets for variations, refingering
for tunings, a low-confidence delete for cleanup). It reports its model as `fake`. CI, the
frontend e2e suite and `ingest --ai` without a key run on it (DECISIONS 54).

## Worked example: the demo walkdown through `/ai/analyze`

No API key was available during the run (DECISIONS 54), so this example is a **transcript
pass**: the backend wrote the exact system prompt and user message that `/ai/analyze` sends
for the demo riff "Walkdown Turnaround", the Claude Code session that built this project
answered them in the model's role, and the answer went through the same validator and
post-processing as a live answer. It shows the shape and the reasoning the layer expects;
it is not an API response, and the token counts are estimates from character counts.

Sizes: system prompt about 12.8k characters (roughly 3.2k tokens, of which the inlined riff
schema is about half), user message about 23.7k characters (roughly 5.9k tokens: the 56-note
riff plus the facts for every note and chord), answer about 0.9k tokens.

The facts told the model, among other things: 23 chords, twenty of them `(6,3)+(5,5)`
Db2+Ab2 labeled P5 with root Db, three of them `(5,5)+(4,5)` Ab2+Db3 labeled P4 with root
Db and `inverted: true`, 55 of 56 notes palm muted, and ten single notes: the open Bb1 at
the top of the loop, the Ab2 held for all of bar 4, and the pairs Eb2, D2, Db2, C2 walking
down the low string.

The answer, after validation and post-processing (all 23 dyads came from the model, none
were computed, no warnings):

```json
{
  "dyads": "23 entries: wd-c01 to wd-c23, P5 root Db for the chugs, P4 root Db inverted for wd-c07, wd-c15, wd-c23 with altLabels [\"P5 (inv)\"], every one source: model",
  "style": {
    "keyCenterGuess": "Db",
    "modeGuess": "chromatic minor, blues-turnaround feel; the open Bb1 pulls toward Bb as the loop point",
    "chromaticDevices": [
      "chromatic descent in half steps on the low string (Eb D Db C)",
      "held note against a moving bass (Ab2 for a whole bar)",
      "inverted power chord on the last eighth of each bar (root on top)",
      "implied tritone and minor sixth under the held Ab (D and C against it)",
      "loop point on the open string a major third below the key center"
    ],
    "turnaroundDetected": true,
    "summary": "Three bars of palm-muted Db power chords in eighths, with the last eighth of every bar flipped to the inverted fourth so the Db root sits on top and the shape lifts before the downbeat. Bar four is the turnaround: Ab2 rings for the whole bar while the low string walks Eb, D, Db, C in palm-muted pairs of eighths, so the held note hears a fourth, then a tritone, then its own fifth, then a minor sixth before the loop drops onto the open Bb1 and the chugs restart. The tension of D and C against the held Ab is the point of the bar and is left unresolved on its own terms; the resolution is the loop itself, back to Db over Bb. Nothing here needs correcting: the riff is a classic blues turnaround played as sludge."
  },
  "warnings": [],
  "model": "claude-code-session (transcript pass, not the API)",
  "promptVersion": 1,
  "usage": { "purpose": "analyze", "attempts": 1 }
}
```

Two things in the answer are the kind of judgment the layer is for and the facts alone do
not contain: the implied intervals between the held Ab2 and the walking bass (the facts only
label notes that share a `chordId`), and the reading of the open Bb1 as the loop's point of
rest a major third below the key center rather than as a wrong note.

## The frontend side

`frontend/src/ai/` and `frontend/src/store/aiSlice.ts` (SPEC 9.3). The AI menu is enabled only
when `/health` reports the backend up with `aiConfigured` true; otherwise each item carries
the reason as a tooltip (`backend unreachable at ...`, `ANTHROPIC_API_KEY not set`, `open a
riff first`, or what is running). AI > Settings is a themed form for the backend URL and an
optional model name sent as `X-Riffspaced-Model`.

- **Analyze** fills the inspector's analysis panel: one chip per dyad (click selects the
  chord's notes and moves the cursor), dashed when the backend computed it, plus the style
  reading, devices, turnaround flag and warnings. View > Dyad labels draws the same labels
  above the chord brackets in the tab. The panel belongs to the riff it was made for and
  disappears when another riff opens.
- **Suggest** opens the right-side drawer and appends cards: name, rationale, playing
  notes, the backend's repairs, a fixed-size mini fretboard with every position used, and
  four buttons. A second request of the same kind sends the cards already shown as `avoid`.
- **Audition** sets `auditionRiff` in the store; the engine's `playableFrom` prefers it, so
  the suggestion plays whole through the chosen voice while the open riff is untouched and
  the fretboard shows the suggestion. Stop (the card, Space, the transport) clears it.
- **Add as variation** is `commit('add ... from AI', riff => appendAsVariation(riff, s))`:
  a new `variation` section after the riff, notes shifted and re-identified, chordIds
  namespaced, tuning required to match (a suggestion in another tuning can only become a
  new riff). One commit, one undo step.
- **Add as new riff** copies the suggestion into the library as a sibling tagged `ai`
  without leaving the open riff.

`/ai/cleanup` is used by `ingest --ai` and is not yet wired into File > Import from audio;
that is in the backlog.

## Waiting on owner: the live smoke test

`backend/tests/live/test_ai_live.py` analyzes the demo walkdown (asserting the turnaround
flag and at least one P5 and one P4) and asks for two variations (asserting valid, playable,
same tuning). It is skipped unless `RIFFSPACED_LIVE=1` and a key are set. To run it once a
key exists:

```
export ANTHROPIC_API_KEY=...        # or put it in backend/.env
cd backend && RIFFSPACED_LIVE=1 uv run pytest tests/live -q -s
```

Paste the printed style summary and usage into this section as the first live worked
example, next to the transcript pass above. No code change is needed.

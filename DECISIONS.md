# DECISIONS.md

Pre-made decisions so the unattended run never has to stop and ask. Each line is a decision, a one-line reason, and the owner's stated preference it serves where there is one. Claude Code appends to the final section when it has to decide something new.

## Product scope for v1 (Phases 0 to 8)

1. **4/4 only.** Mixed meters are backlog. Store `timeSignature` anyway for forward compatibility.
2. **Loop lengths 4, 8, 12, 16 bars.** Nothing else in the selector.
3. **Bb Standard is the default tuning.** E Standard is available but not default.
4. **Default fret view 0 to 12, up to 24 available.** Riffs live near the nut.
5. **Flats by default, sharps as a toggle.** Owner preference.
6. **Dots by default, note letters inside dots as a toggle.** Owner was considering letters inside dots; make it the letters mode.
7. **Dyad naming modes are backlog.** Only the interval label ships in v1. The data function `describeDyad` ships so the UI can grow into it.
8. **Playback voice: basic synth first.** Heavy voice is a stretch item in Phase 4, otherwise Phase 8. Samples and amp sims are backlog.
9. **Frontend must work with no backend.** Audio import and AI are additive.
10. **Three data tiers: riff, arrangement, song.** Plus a library bundle for backup. Owner asked for three tiers and standard load/save.

## Technology

11. **React 18 + TypeScript + Vite** for the frontend. Reliable for automated building; componentized; static deploy.
12. **Zustand** for state. Small, and undo is a plain snapshot stack.
13. **SVG, not canvas,** for fretboard and tab lanes. Inspectable, crisp, declarative. Playhead moves via a ref to avoid per-frame React renders.
14. **Web Audio API directly, no Tone.js.** The lookahead scheduler is about 100 lines and is the thing worth learning. If scheduling becomes a time sink in Phase 4, Tone.js is the sanctioned fallback; record it here if used.
15. **Plain CSS with custom properties.** No Tailwind, no component library. The look is one theme file.
16. **Hand-written MIDI writer and MusicXML writer.** Small, deterministic, teachable, dependency-free.
17. **Hand-written minimal JSON validation in the frontend** (checks the fields that matter), full `jsonschema` validation in the backend. Avoids an ajv dependency in the browser bundle.
18. **Python 3.12, FastAPI, numpy, scipy, soundfile.** No music-analysis libraries in the core path (owner wants his own analysis). A reference oracle may live under `backend/tools/benchmark/`, off by default.
19. **Karplus-Strong plus tanh waveshaping as the test-signal synth** in Python. It is the owner's own crude amp, which is the point.
20. **Claude SDK model default: `claude-sonnet-5-5`,** overridable with `RIFFSPACED_MODEL`. Cost-sensible for JSON-in, JSON-out musical reasoning. The owner can point it at any model he has access to.
21. **Fingering-constrained spectral template matching with Viterbi decoding** is the Stage 1 analysis method (SPEC section 8.2). Monophonic pitch trackers fail on fuzzed dyads; this method searches only what the owner's hands can actually play, which is the insight that makes it tractable. Document it in `docs/ANALYSIS_METHOD.md`.
22. **The Claude API does not accept audio** (checked 2026-10-24). Python produces symbolic events; Claude reasons over them. Re-check once at the start of Phase 6.

## Conventions

23. **Strings numbered 1 (highest) to N (lowest); tunings stored low to high.** Guitarist convention for strings, DAW convention for pitch arrays. `pitchOf(s, f) = pitches[N - s] + f`.
24. **PPQ 480, integer ticks everywhere in stored data.** No floating seconds in files.
25. **Low string at the bottom of the fretboard and at the bottom of the tab lanes.** Matches printed tab.
26. **MIDI C4 = 60.** Bb1 = 34.
27. **IDs are UUID v4 strings.** `crypto.randomUUID()` in the browser, `uuid4()` in Python.
28. **Timestamps are ISO 8601 UTC.**
29. **File extensions:** `.riff.json`, `.arr.json`, `.song.json`, `.riffspaced.json` for the library bundle.

## Process

30. **Repo `riff-spaced`, public, created with `gh repo create` in Phase 0.** Owner wants the GitHub hooked up from the start and used as it goes.
31. **Commit after every task, push after every commit, tag at every phase gate.** Owner asked for frequent commits with detailed human-readable messages and save points.
32. **Pause only at HARD STOP items** (CLAUDE.md). Owner asked for both "pause whenever there's a choice of direction" and "as much done in auto as possible"; the resolution is that the choices are made here, in advance, so there is nothing left to pause for except secrets, his audio files, and destructive operations.
33. **Playwright is the gate, Claude in Chrome is the eyes.** Playwright must pass; the Chrome pass is for visual confirmation and console errors and is recorded in the commit TEST line.
34. **GitHub Pages deploys the frontend from `main` on every push** via Actions. The backend is not deployed anywhere by CI; it runs locally or in Docker.
35. **`STATUS.md` is the handoff document.** The owner reads it, not the git log, to catch up.
36. **No em dashes in any written output.** Owner preference.

## Made during the run

(Claude Code appends here: `N. **Decision.** Reason. Phase/task.`)

37. **Repo is `spaced-lab/Riff-SPACED`, public.** Owner's instruction on 2026-10-24: host under the spaced-lab org (owner is org admin), authenticated as RidleyDiSiena, repo name matching the project name. Pages base path is `/Riff-SPACED/`. Pre-run.
38. **Git pushes use HTTPS with `gh` as the credential helper.** The SSH agent on this machine has no identity loaded and GitHub refused the key; `gh auth setup-git` makes every push use the existing gh login. Pre-run.
39. **P6.T10 real recordings: if `backend/audio_in/` is empty, skip, log in BACKLOG, continue.** Owner pre-authorized this so the run does not halt in Phase 6. Pre-run.
40. **Backend uses Python 3.12 pinned through uv (`.python-version`).** Local `python3` is 3.14; SPEC fixes 3.12 and CI runs 3.12, so the venv matches CI. Pre-run.
41. **CI runs Node 22 LTS, not 20.** Node 20 reached end of life in April 2026; local is Node 26, which is fine for dev. Pre-run.
42. **`/compact` is a user command, not something the agent can invoke.** Context is managed automatically; the phase-gate compaction step is satisfied by rewriting STATUS.md so any resumed session can pick up. Pre-run.
43. **Dev server stays on port 5173.** The owner approved stopping an unrelated Vite server that held the port. Pre-run.
44. **Demo riff positions follow SPEC 3.3 math, phase text corrected.** In Bb Standard the low strings are a fourth apart, so the plan's "P5 at fret 3 on strings 6 and 5" was a P4 and its note names were a whole step off. The demo now uses 6:3 + 5:5 for the P5, 5:5 + 4:5 for the inverted P4, and holds 5:5 (Ab2) under the 5-5-4-4-3-3-2-2 walkdown. P1.T1.
45. **`findFingerings` returns positions lowest-pitched string first; `bestFingering` ties break toward the lower-pitched string, then the lower fret.** SPEC 3.6 left the order open; the fixture pins it. Hand position is the lowest fretted finger. P1.T1.
46. **Fixture ids are readable strings; generated ids are UUID v4.** Schemas require a non-empty string id, not a uuid format, so demo and test fixtures can carry ids like `wd-n01` that a reader can follow. DECISIONS 27 still governs what the app generates. P1.T1.
47. **Dyad label for 0 semitones is `P1` for identical pitches and `P8` for an octave.** SPEC 3.5 lists "unison/octave"; the two labels keep the data function unambiguous. P1.T1.
48. **Heavy voice shipped in Phase 4 (the stretch item), not Phase 8.** The basic voice took less than the task budget; the heavy voice reuses its envelopes and adds a sub oscillator and a shared tanh drive stage, about 80 lines. P4.T2.
49. **Phase 6 preflight: the Messages API still has no audio content block (re-checked 2026-10-25).** User content blocks are text, image (jpeg/png/gif/webp), document (pdf, plain text), search_result, tool_result and container_upload. The division of labor stands: Python extracts symbolic note events, Claude reasons over them. P6 preflight.
50. **Tempo is estimated from the tatum: the shortest strong autocorrelation period times 1, 2, 4 or 8, chosen by a prior around 100 BPM.** Plain autocorrelation read eighth-note riffs as double tempo and found a three-eighths alias; in 4/4 only binary multiples of the smallest note value are beats. A 160 BPM eighth-note riff reads as 80 BPM, which SPEC P6.T4 accepts; the import dialog lets the owner override. P6.T4.
51. **Ring times in the test synth mean a 40 dB drop, not 60.** A palm mute that falls 60 dB in 120 ms has almost no pitched content, which no real palm mute does; at 40 dB the muted notes are still clearly pitched and the analysis has something to read. P6.T6.
52. **The matcher identifies what is new in each slice; whether earlier notes still ring is decided by evidence afterwards.** Matching the full spectrum made a held note hide the next pick and re-emitted the held note every slice. The novel spectrum (slice minus the previous slice's tail, floor removed) plus `sustain_evidence` on the full spectrum fixed both. P6.T6.
53. **Viterbi emissions are rescaled by a temperature of 0.01.** The spec's transition costs (0.08 per fret, 0.05 per string change, 0.10 repeat bonus) assume emissions on a comparable scale; raw cosine margins are about 0.02, and without rescaling the repeat bonus locked the path onto one shape for a whole file. P6.T6.
54. **Phase 7 is built on the fake client; the live smoke test waits for a key.** Owner decision 2026-10-25 after the HARD STOP: no `ANTHROPIC_API_KEY` is available. P7.T1 to T4, T6 and T7 run and are tested against `fake_client.py` (`RIFFSPACED_AI_FAKE=1`); P7.T5 is written but skipped unless `RIFFSPACED_LIVE=1`. The worked example in docs/AI_LAYER.md comes from a transcript pass answered by the Claude Code session, labeled as such. Owner recordings dropped in `injest-raw/` are gitignored and fed to the P6.T10 recipe on resume. P7 preflight.
55. **The AI client sends no sampling parameters.** The plan asked for temperature 0.7 on suggest and 0.2 on analyze and cleanup, but the installed SDK (anthropic 2.3.0) and current models reject `temperature`, `top_p` and `top_k` with a 400. Variety comes from the prompt instead: the suggest prompt requires the N suggestions in one call to differ in a named way and the request carries an `avoid` list of suggestions already shown; consistency comes from the backend precomputing the dyad facts and validating the JSON shape. P7.T1.
56. **Task prompts are templates rendered from the sources of truth.** `{{STYLE_DIRECTIVE}}`, `{{TUNING_TABLE}}`, `{{DYAD_TABLE}}` and `{{RIFF_SCHEMA}}` are filled at load time from the directive file, the tuning presets, the dyad labels and `shared/schema/riff.schema.json`, rather than pasting copies into the markdown. The prompt cannot drift from the validator, and the test that checks the directive is verbatim compares against SPEC.md itself. P7.T1.
57. **Outboard transcriptions enter through riff JSON, not through a new format.** The owner wants to feed recordings to external audio tools or another LLM; `outboard-guidance/` documents the existing riff format and the fingering, timing and dyad conventions for them, and `injest-riff-JSON/` plus `riffspaced.check_riffs` validate what comes back with the same validator the app uses. One format in, one validator, so the built-in analyzer and any outboard result can be compared note for note. Owner request during P7.
58. **Transpose and retune keep the fixture's fingering cost model, even when it picks open strings.** Transposing the demo walkdown up two puts the Eb2+Bb2 chug on open string 5 plus 4:2 (no span, no hand movement from the open C2 before it) rather than 6:5+5:7. The owner may prefer the fretted shape for chugging, but the cost model (DECISIONS 45) is the shared contract both implementations test against; changing it is a tuning of `FINGERING_COST`, not of the transpose tool. Recorded in the new `transpose` fixture section with the reason. P8.T1.
59. **Easier-tuning ties break by least retuning, then presets, then name.** The plan's score (unreachable, span, movement) ties often: Drop D, Drop C and Drop A all turn E Standard power chords into same-fret shapes. The tuning that moves the fewest semitones from the current one wins the tie, a named preset beats a one-string adjustment, and the name decides the rest, so "drop your low string" ranks above "retune everything". P8.T2.

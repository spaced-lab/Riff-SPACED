# Backlog

Items that are explicitly out of v1 (SPEC section 12), plus anything deferred during the run with the reason it was deferred.

## From the spec

- Dyad naming modes (interval / power-chord / implied triad); v1 ships the interval label only.
- Mixed meters and odd time; v1 is 4/4 only, `timeSignature` is stored for forward compatibility.
- Tempo map (tempo changes within a riff or arrangement).
- Slow practice loops with speed ramp.
- Riff version history.
- Link a riff to its source recording with waveform display.
- PDF tab export.
- Sample-based or amp-sim playback voices.
- MIDI input from a controller.
- Dyad-aware chord symbols on the tab.
- Mobile layout.
- Collaborative sharing.
- Local LLM option for the AI layer.

## Deferred during the run

(appended as it happens, with the phase, the reason, and any numbers)

- **Phase 6, P6.T7: benchmark thresholds not fully met.** Final matrix (36 cases): onset F1 0.868 (threshold 0.90), note F1 0.779 (0.80), fingering accuracy 0.867 (0.70, met), tempo within 2 BPM 0.694 (0.80). All of the shortfall is the synthetic "Chromatic Run" (legato sixteenths on ringing strings: onset F1 0.22, note F1 0.00, tempo off by 47 BPM) plus the "Slow Tritone" tempo (3 onsets in 16 s, undecidable). Without the chromatic run the averages are onset 0.98, note 0.92, fingering 0.91, tempo 0.83. Three tuning iterations were spent (flux margin 0.08/0.10/0.12, pitch-jump gap 0.06/0.08/0.12, fundamental-band pitch tracker, normalization past the first frame); the only settings that helped the legato run put phantom notes into palm-muted riffs, so they were rejected. Next idea: a per-string pitch-continuity segmenter for legato passages (track the dominant pitch of the novel spectrum and cut a segment on every semitone step), used alongside the flux detector.
- **Phase 6: octave dyads read as the lower note alone.** The upper note's harmonics are a subset of the lower's; dyad accuracy 0.40 on the "Octave Chug" bench riff. A test on the relative strength of even harmonics, or on the beating between the two strings, could tell them apart.
- **Phase 6: tempo with very few onsets.** Below eight onsets the estimator falls back to the best-aligned grid, and with three onsets every grid aligns, so the prior decides (90 BPM for a 60 BPM take). The import dialog's BPM override covers it for now.
- **Phase 6, P6.T10: real recordings, first pass done 2026-10-25, accuracy unknown.** Three owner takes ran end to end (`docs/benchmarks/real-audio-notes.md`): flat dyad histogram, zero palm mutes detected in 806 notes, tempo scores under 0.1, and the same low-end peaks in all three files. Open: the tuning and a tab for at least one take (owner), a relative palm-mute detector, a compression-tolerant onset flux, a rerun with a smaller search space, and a note-for-note comparison with an outboard transcription (`outboard-guidance/`).
- **Phase 7: cleanup pass not in the import dialog.** `POST /ai/cleanup` runs from `ingest --ai`; File > Import from audio does not offer it yet. Add a "clean up with AI" checkbox that calls it after `/analyze` and shows the accepted and rejected changes next to the report.
- **Phase 7: live smoke test never run.** No `ANTHROPIC_API_KEY` during the run (DECISIONS 54); `backend/tests/live/` waits for one, recipe in docs/AI_LAYER.md.
- **Phase 7: server-side refusal fallbacks not enabled.** The live client surfaces a refusal as an `AiError` with its category; the API's `fallbacks` option could reroute instead. Decide once the live test has run.
- **Owner request (2026-10-25): extract the riffs in `injest-raw/` and emit YAML. First pass done.** YAML is written beside every riff JSON (`riffspaced.yamlout`, also from `ingest`), the same-tick collision was fixed, and the measurements are in `docs/benchmarks/real-audio-notes.md` (second pass): no note decays fast enough for the palm-mute rule, the transcriptions do not repeat bar to bar, and the recordings' onset patterns show no riff-scale period. Open: a recording of a known riff (looped) and a drier capture from the owner; then a relative palm-mute detector (decay against the file's median) and a bar-alignment step that uses the known riff length. Analyzer tuning without ground truth was stopped on purpose.
- **Phase 8: Tab is the note-letters shortcut, so keyboard traversal of the controls is not possible with Tab.** SPEC 5.8 binds Tab to View > Note letters (Phase 2). Every control is focusable and the theme draws a green focus ring, but a keyboard-only user cannot walk the menus and transport with Tab. Move the letters shortcut (for example to `n`) and verify the Tab order; the e2e focus test is written so it can be extended.

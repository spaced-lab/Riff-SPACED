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
- **Phase 6, P6.T10: real recordings not yet run.** `backend/audio_in/` was empty at the end of Phase 6, and the owner pre-authorized skipping (DECISIONS 39). When recordings arrive: `cd backend && uv run python -m riffspaced.ingest audio_in --out riffs_out --tuning "Bb Standard"`, open the results with File > Import from audio or File > Open, and write `docs/benchmarks/real-audio-notes.md` describing what worked and what did not (no audio committed). Expect the first pass to need the knobs in `docs/ANALYSIS_METHOD.md` (inharmonicity, intermodulation weight, flux margin) tuned against the real rig.

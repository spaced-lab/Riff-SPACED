# Real recordings: first pass (P6.T10, run 2026-10-25)

The owner dropped three phone recordings (AAC in `.m4a`, 48 kHz stereo, peak -1 dBFS) into
`injest-raw/`; they were copied to `backend/audio_in/` and run through the Phase 6 analyzer
with the defaults (`Bb Standard`, frets 0 to 12, strings 6 5 4 3). No audio is committed. No
tab of what was played exists yet, so this page records what the analyzer produced and what
the numbers say about it, not an accuracy score.

```
cd backend
uv run python -m riffspaced.ingest audio_in --out riffs_out --tuning "Bb Standard"
```

| File | Length | Detected BPM (score) | Bars | Notes | Mean confidence | Below 0.6 | Palm muted | Time |
|---|---|---|---|---|---|---|---|---|
| RS-Descent | 52.6 s | 155.7 (0.07); 102.0, 77.8 | 36 | 249 | 0.56 | 98 | 0 | 2.8 s |
| RS-NM1 | 93.4 s | 99.1 (0.03); 113.0, 107.5 | 40 | 459 | 0.57 | 169 | 1 | 4.7 s |
| RS-Spider | 16.2 s | 138.9 (0.09); 69.5, 92.8 | 12 | 98 | 0.61 | 31 | 1 | 1.0 s |

Interval histogram of the dyads the matcher emitted (chords with two notes):

| File | P4 | P5 | m3 | M3 | m2 | M2 | TT | m6 | M6 | m7 | M7 | P1/P8 | single notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RS-Descent | 25 | 8 | 15 | 12 | 13 | 12 | 8 | 12 | 6 | 6 | 1 | 2 | 9 |
| RS-NM1 | 37 | 13 | 28 | 30 | 12 | 23 | 19 | 11 | 14 | 9 | 7 | 10 | 33 |
| RS-Spider | 2 | 3 | 5 | 5 | 8 | 11 | 2 | 2 | 1 | 2 | 3 | 0 | 10 |

Fret histogram, all three files together: frets 7 to 10 hold 57 percent of the notes; fret 0
holds 8 percent; frets 1 to 3 hold 3 percent.

## What the numbers say

1. **The dyad histogram is nearly flat.** The owner plays fifths, fourths, thirds, tritones and
   minor seconds, so a good transcription should be dominated by three or four interval
   classes. Every interval from m2 to M7 appears at a similar rate, including m6, M6 and m7,
   which the owner rarely plays. That is the signature of a matcher that is not locking onto
   the real shapes and is choosing among near-equal candidates frame by frame. The synthetic
   benchmark did not show this because its templates were rendered by the same model the
   matcher assumes (DECISIONS 51 to 53 describe that model).
2. **Zero palm mutes in 806 notes.** The owner's style is mostly palm muted. `is_palm_muted`
   needs a 20 dB drop within 120 ms of the peak. Phone recorders apply automatic gain and a
   limiter, the room adds a tail, and a cabinet does not stop like a synthesized string, so
   the drop never reaches 20 dB in 120 ms. The detector is tuned to the synth, not to a rig.
3. **Low confidence everywhere.** Mean 0.56 to 0.61 with 30 to 40 percent of notes below 0.6.
   Confidence is the score margin between the best candidate and the runner-up; a flat
   margin is the same story as point 1 told a second way.
4. **Tempo scores are tiny.** 0.03 to 0.09 (the synthetic cases scored 0.3 and up). The
   autocorrelation of the onset strength is weak, which means the onsets themselves are
   weak or irregular. Spectral flux on a compressed, reverberant recording has far less
   contrast than on the dry synth; the onset detector is the first stage to revisit.
5. **The low end is the same in all three files.** Taking the lowest strong peak per loud
   frame (within 10 dB of the loudest bin below 130 Hz), all three recordings cluster at
   85 to 90 Hz (F2), 95 to 100 Hz (G2) and 75 to 80 Hz (Eb2), with almost no frames at
   58 to 65 Hz (Bb1, B1). Three different riffs sharing one low-end histogram is not musical
   content; it is either a fixed resonance (phone, room, cabinet) or the riffs really live
   around frets 5, 7 and 9 of the low string, which is also where the fret histogram
   peaks. This cannot be settled without the owner. If the guitar was not in Bb Standard,
   every fret in these results is off by the difference.

## What to try next, in order

1. Ask the owner for the tuning of each take and, for at least one, the tab or a description
   of the riff. One known riff turns this page from observations into a measurement.
2. Make the palm-mute detector relative: compare each note's decay with the recording's own
   distribution of decays (a muted note decays much faster than the median note in the same
   file), instead of an absolute 20 dB in 120 ms.
3. Give the onset detector a high-passed, compressed flux (log of the band energy ratio) so
   that AGC and reverb matter less, and check the onset count against what a human counts in
   the first ten seconds.
4. Re-run with `--strings 6,5,4` and `--max-fret 10` to see whether a smaller search space
   makes the histogram peak where it should. If it does, the matcher's problem is candidate
   confusion, not the spectra.
5. Compare against an outboard transcription of the same file (`outboard-guidance/`,
   `injest-riff-JSON/`), note for note, once one exists.

The riff JSON for the three takes is in `backend/riffs_out/` on the owner's machine
(gitignored); they open in the app with File > Open and sound like a dense chromatic
cluster, which matches the histogram above.

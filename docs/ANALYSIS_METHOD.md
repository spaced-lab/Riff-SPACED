# The analysis method

How RIFF-SPACED turns a recording of low-tuned, distorted guitar into riff JSON laid out on the fretboard the way the owner plays (Phase 6, `backend/riffspaced/analysis/`). Numpy and scipy only; no music-analysis libraries in this path (DECISIONS 18). The owner wants his own analysis, iterated against what an advanced model makes of the same material.

## Why monophonic pitch trackers fail here

The owner plays dyads: power chords, inverted power chords, thirds, tritones, on the two or three lowest strings of a guitar tuned to Bb, through heavy distortion and fuzz. Three things go wrong for a generic pitch tracker:

1. **Two fundamentals.** A monophonic tracker reports one pitch. For a Db2 + Ab2 power chord it reports Db2, Ab2, or the common period below both, depending on the frame.
2. **Harmonics outrun fundamentals.** With palm muting and distortion the fundamental of a Bb1 (58 Hz) is often weaker than its third and fifth harmonics. Trackers that pick the loudest peak land an octave or a twelfth too high.
3. **Intermodulation.** A `tanh` stage (every fuzz pedal and overdriven amp) mixes the two notes: for fundamentals f1 and f2 it creates tones at f1 + f2, |f1 - f2|, 2f1 - f2 and 2f2 - f1 at real amplitude. For Db2 + Ab2 (69.3 and 103.8 Hz) that is a tone at 173.1 Hz which belongs to neither string. A tracker sees a third note.

The test synth (`synth.py`) reproduces all three on purpose, so the pipeline is scored against them.

## The trick: search only what the hands can play

Instead of asking "which frequencies are present", the matcher asks "which playable shape sounds most like this". On a six-string in Bb Standard, searching the lowest four strings up to the twelfth fret, there are 52 single notes and a few hundred dyads on adjacent or one-apart strings within a four-fret span. That is a small enough set to score exhaustively for every slice of audio.

Each candidate has a **predicted spectrum**:

- for each of its pitches, a harmonic comb from the fundamental to the twelfth harmonic with weights `1 / h^0.8` and a little inharmonicity, `f_h = h f0 sqrt(1 + B h^2)` with `B = 2e-4`, because heavy strings run sharp in the upper partials;
- for a dyad, the four intermodulation tones at weight 0.15 each;
- every line drawn as a Gaussian 0.8 bins wide (1.5 blurred B1 against Db2, whose fundamentals are 7.6 Hz apart);
- plus a flat **silence** template so gaps and dead notes are an explicit answer rather than a wrong note.

The **observed spectrum** of a segment is what is *new* in it: the mean magnitude over the loud frames of its first 300 ms after a 20 ms attack skip, minus the tail of the previous segment (what was already ringing), with the segment's own noise floor removed so broadband pick noise does not reward busy templates. The mean over the opening is what keeps a short palm-muted note that shares its slice with a long ringing one; a median over the whole slice lost it. Both sides are compared in the same domain: square-root compression (so loud partials do not dominate) and a `1 / sqrt(f)` weighting (so the linear bins of the FFT do not over-represent the highs). The score is the cosine similarity of the two unit vectors, minus a small penalty for dyads (a second note has to earn its place), plus a **peak bonus**: the fraction of the candidate's first six harmonics that appear as interpolated peaks within 35 cents, gathered from the three loudest frames. The bins are 10.8 Hz wide but interpolated peaks resolve a few cents, and a semitone is 2.8 percent of frequency: the peak bonus is what tells neighboring frets apart on the low strings when the Gaussian cosine cannot.

Templates do not depend on the audio, so they are computed once per candidate and cached.

Whether the previous notes are *still ringing* through a segment is decided afterwards by evidence (`sustain_evidence`): if a template holding the previous pitches as well as the new ones explains the segment's full spectrum better than the new event alone, the earlier notes are extended instead of re-emitted. That is how the walkdown's held Ab2 becomes one note under eight moving low notes. Palm-muted notes are never extended; they are gone within 120 ms.

One idea was tried and rejected: penalizing any pitch whose fundamental is not among the top peaks. Under distortion the peak list is mostly upper partials and intermodulation, so real second notes were punished and dyad accuracy fell from 0.54 to 0.13. The code carries a note so nobody repeats it.

## The pipeline, stage by stage

| Stage | Module | Idea |
|---|---|---|
| load | `io.py` | mono, 44.1 kHz, peak at -1 dBFS; soundfile, or ffmpeg for mp3 |
| preprocess | `preprocess.py` | zero-phase bandpass 35 Hz to 6 kHz, onsets stay put |
| frames | `stft.py` | 4096-point Hann, 512 hop; Bb1 is 58 Hz and the bin spacing is 10.8 Hz; interpolated peaks per frame |
| onsets | `onsets.py` | spectral flux on a short 1024/256 STFT (attack timing within a frame), adaptive threshold, 50 ms gap; a pitch-jump detector for slides and soft second notes |
| tempo | `tempo.py` | autocorrelation of the flux; the tatum (shortest strong period) times 1, 2, 4 or 8, picked by a prior around 100 BPM |
| match | `fingering_match.py` | the template matcher above: a segment by candidate score matrix |
| decode | `decode.py` | Viterbi over segments: emissions are the scores rescaled by a temperature of 0.01 so a 0.02 margin is decisive and the hand-movement costs only break ties; the path prefers shapes a hand would actually move between |
| quantize | `quantize.py` | snap to sixteenths at the chosen tempo, pick the downbeat, classify palm mutes by decay |
| emit | `emit.py` | riff JSON with confidences, validated against the shared schema |

## What the owner may want to tune later

All in `fingering_match.py` as named constants:

- `HARMONICS` and `HARMONIC_ROLLOFF`: how many partials a template has and how fast they fall. Brighter rigs want a slower roll-off.
- `INHARMONICITY_B`: stiffer, heavier strings want a larger `B`.
- `INTERMOD_WEIGHT`: how much fuzz the templates assume. More gain, more weight.
- `PEAK_WIDTH_BINS`: tolerance for tuning drift and vibrato.
- `PEAK_BONUS`, `BONUS_HARMONICS`, `PEAK_TOLERANCE_CENTS`: how much the interpolated peaks count and how many harmonics they check.
- `DYAD_PENALTY`: how much a second note has to earn.
- `SUSTAIN_MARGIN` (in `quantize.py`): how much better the union template must fit before a note is held through the next one.
- `DEFAULT_STRINGS`, `DEFAULT_MAX_FRET`, `DEFAULT_MAX_SPAN`: the search space, which is also the statement of how he plays.

And in `decode.py`, the transition costs: how much a fret jump, a string change, or repeating the previous shape should cost.

## Results

The benchmark table from `make bench` is pasted here at the end of the phase (P6.T7), with the thresholds from the phase file: onset F1 at least 0.90, note F1 at least 0.80, fingering accuracy at least 0.70, tempo within 2 BPM on at least 80 percent of cases.

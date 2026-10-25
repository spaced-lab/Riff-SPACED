# Phase 6: Audio analysis backend

Goal: a folder of recordings becomes riff JSON laid out on the fretboard the way the owner plays, using his own analysis code (numpy/scipy only), validated against synthetic ground truth the pipeline generates for itself, exposed through a FastAPI service and an "Import from audio" flow in the frontend. This is the largest phase. Work stage by stage; each stage is a commit.

Read first: SPEC 8 (all), 2.2, 9.1 (for the later cleanup pass); DECISIONS 18, 19, 21, 22.

Preflight for this phase: fetch `https://platform.claude.com/docs/en/api/messages` once and confirm whether an audio content block exists. Record the answer in `DECISIONS.md` under "Made during the run". If audio IS now accepted, add a note to Phase 7 to offer an optional direct-audio path; the pipeline below is built regardless.

## P6.T1 Audio I/O and preprocessing

`riffspaced/analysis/io.py` (`load_audio(path) -> Audio` dataclass `{samples: np.ndarray float32 mono, sr: int, path}`; soundfile first; if the extension is mp3/m4a and ffmpeg exists, decode via `ffmpeg -i ... -f f32le -ac 1 -ar 44100 -` subprocess; else raise `UnsupportedFormat` with a clear message), `preprocess.py` (`highpass_lowpass(audio, 35, 6000)` using `scipy.signal.butter` + `sosfiltfilt`, `normalize_peak(audio, -1 dBFS)`).

Tests: synthetic sine at 58.27 Hz survives the filter with amplitude within 1 dB; a 20 Hz rumble is attenuated by more than 20 dB; WAV round trip; unsupported extension error message.

Commit: `feat(analysis): add audio loading, resampling, and band-limiting preprocessing`.

## P6.T2 Test-signal synth (ground truth generator)

`riffspaced/synth.py`: `render_riff(riff: dict, sr=44100, drive=6.0, noise_db=-60, voice="ks") -> np.ndarray`. Karplus-Strong per note: delay line length `sr / f0` with fractional interpolation, loop filter average with damping `rho` tuned so a Bb1 rings about 2.5 s unmuted and 0.12 s with `palmMute`; initial excitation is a short burst of filtered noise (pick). Sum voices at their tick times, then `tanh(drive * x)` and a 4 kHz lowpass, then add white noise at `noise_db`. Also `render_click_track` for tempo tests.

CLI: `python -m riffspaced.synth shared/fixtures/demo-library.json --riff "Walkdown Turnaround" --out backend/debug/walkdown.wav --drive 8`.

Tests: rendered length matches `lengthBars` at the BPM; a single-note riff's spectrum peak is at the expected f0 within 1 percent; drive increases the harmonic-to-fundamental ratio (that is the point of the test: distortion creates the overtones the analysis must survive).

Commit: `feat(synth): add Karplus-Strong plus waveshaper test-signal renderer for ground truth`.

## P6.T3 STFT and onset detection

`stft.py` (`frames(audio, n_fft=4096, hop=512) -> Spectrogram` with `mag_db`, `freqs`, `times`, and `peaks_per_frame` via parabolic interpolation), `onsets.py` (spectral flux per SPEC 8.2 step 4, adaptive threshold, peak picking, plus the pitch-jump secondary detector; returns `Onsets {times, strengths}`).

Tests: a rendered 4-bar riff of sixteenth palm-muted chugs at 100 BPM yields onset count within ±2 of 64 and onset times within 25 ms of the known tick times (compute F1 with a 30 ms window; require F1 ≥ 0.95); sustained notes with vibrato produce no spurious onsets more than 1 per bar.

Debug: with `RIFFSPACED_DEBUG=1`, save `debug/<name>_onsets.png` (spectrogram with onset lines).

Commit: `feat(analysis): add STFT with interpolated peaks and spectral-flux onset detection`.

## P6.T4 Tempo estimation

`tempo.py`: autocorrelation of the onset-strength envelope, candidates 40 to 220 BPM, mild prior 70 to 140, octave disambiguation (prefer the candidate whose beat grid aligns onsets with the smallest mean error), returns top 3 with scores.

Tests: rendered riffs at 80, 92, 120, 160 BPM recover within ±2 BPM as the top candidate (160 may legitimately return 80; accept either but record which).

Commit: `feat(analysis): add autocorrelation tempo estimation with octave disambiguation`.

## P6.T5 Fingering-constrained spectral template matching

`fingering_match.py` per SPEC 8.2 step 7:
- `enumerate_candidates(tuning, max_fret=12, strings=(6,5,4,3), max_span=4) -> list[Candidate]` where `Candidate` has `positions: tuple[(string, fret), ...]` (1 or 2 positions) and `pitches`. Include a `SILENCE` candidate.
- `predicted_spectrum(candidate, freqs) -> np.ndarray` with the harmonic comb, inharmonicity, intermodulation terms for dyads, Gaussian peaks; cached per candidate (they do not depend on the audio).
- `score(observed, predicted)` cosine similarity in `sqrt`-compressed magnitude with the peak bonus.
- `segment_spectra(spec, onsets)` median spectrum per inter-onset segment skipping the first 20 ms.
- `score_matrix(segments, candidates) -> np.ndarray[n_segments, n_candidates]`.

Tests: a rendered P5 dyad (6:3 + 5:3) at drive 8 scores its true candidate highest among all candidates; the same for an inverted P4 (6:5 + 5:3), a tritone (6:1 + 5:2), a chromatic m2 (6:3 + 5:... pick a reachable one), and a single open Bb1; a dead note scores SILENCE highest. Report the margin between the best and second-best score in the test output so regressions are visible.

Debug: `debug/<name>_scores.png` heat map of the score matrix.

Document the method in `docs/ANALYSIS_METHOD.md` as you build it: why monophonic trackers fail on fuzzed dyads, why intermodulation terms matter, why constraining to playable shapes is the trick, what the owner may want to tune later (`B`, harmonic weights, intermod weights).

Commit: `feat(analysis): add fingering-constrained spectral template matching for notes and dyads`.

## P6.T6 Viterbi decode, quantize, emit

- `decode.py`: Viterbi over segments; emission = score; transition cost = `0.08 * fret_distance + 0.05 * string_change + (-0.10 if same shape as previous)`; also returns per-segment posterior margin as `confidence` in 0..1 (margin normalized by a running max).
- `quantize.py`: downbeat offset search, snap to 1/16 at the chosen BPM with tolerance 45 percent of a sixteenth, durations to next onset clipped to grid, `palmMute` classification by decay per SPEC 8.2 step 9, `lengthBars` rounded up to 4/8/12/16.
- `emit.py`: build the riff dict, validate with `model.validate`, return the riff plus a `Report` dataclass (BPM candidates, mean confidence, count of low-confidence events, warnings).
- `pipeline.py`: `analyze(path, options) -> (riff, report)` chaining every stage with timing logs.

Tests: full pipeline on the rendered demo "Walkdown Turnaround" at drive 6 recovers: BPM within 2, note F1 (pitch and onset within 30 ms) ≥ 0.85, fingering accuracy ≥ 0.75, the bar 4 chromatic walkdown present as four distinct pitches descending. On "Tritone Chug" the tritone dyads are detected as TT with the right positions in at least 3 of 4 occurrences.

Commit: `feat(analysis): add Viterbi fingering decode, grid quantization, and riff emission`.

## P6.T7 Benchmark harness

`backend/tools/benchmark/run.py`: renders every riff in `shared/fixtures/demo-library.json` and `shared/fixtures/bench/*.riff.json` (add four more hand-written riffs here covering: open-string chugs with octave dyads, a fast sixteenth single-note run, slow sustained dyads with a tritone left unresolved, and a riff that uses the fourth string) at drives {3, 6, 10} and noise {-60, -35} dB; runs the pipeline; writes `docs/benchmarks/latest.md` with a table (riff, drive, noise, BPM error, onset F1, note F1, fingering acc, dyad acc, mean confidence, seconds) and a summary line; also writes `docs/benchmarks/history.csv` appending one row per run with the git short hash.

Thresholds (fail the task if not met; tune the pipeline, not the thresholds): averaged over the matrix, onset F1 ≥ 0.90, note F1 ≥ 0.80, fingering accuracy ≥ 0.70, BPM within 2 on at least 80 percent of cases. Spend up to three tuning iterations; if still short, record the gap in `docs/BACKLOG.md` with the numbers and continue (not a HARD STOP).

This task may use one subagent to write the extra bench riffs while the main thread writes the harness.

Commit: `test(analysis): add synthetic benchmark harness with committed results`.

## P6.T8 Ingest CLI and API endpoints

- `riffspaced/ingest.py` with the CLI from SPEC 8.4 (`argparse`, progress per file, `<name>.riff.json` and `<name>.report.md` outputs, exit code non-zero if any file failed, `--ai` flag wired in Phase 7 and inert until then with a notice).
- `api.py`: `POST /analyze` (multipart file + JSON options), `POST /analyze/batch`, `GET /tunings`, request size limit 50 MB, timeouts, clear 4xx messages. Background execution via FastAPI `run_in_threadpool`.
- `tests/test_api_analyze.py`: posts a rendered WAV and asserts a valid riff comes back.

Commit: `feat(backend): add ingest CLI and analyze endpoints`.

## P6.T9 Frontend import flow

- `File > Import from audio...`: dialog with file picker (multiple), tuning (default current), optional BPM override, max fret, strings; shows per-file progress; results land in the library tagged `imported` with `source.type = "audio"`; low-confidence notes render amber; a report drawer shows the `Report` text.
- `api/client.ts`: typed fetch wrapper, health polling every 15 s for the status bar, `VITE_BACKEND_URL`.
- When the backend is down the menu item is disabled with the reason.

Playwright: mock the backend with Playwright's `page.route` returning a canned riff; assert the riff appears amber where confidence is low. Chrome verification uses the real backend.

Commit: `feat(frontend): add import-from-audio flow with backend health status`.

## P6.T10 Real recordings (HARD STOP if folder empty)

If `backend/audio_in/` has files: run `python -m riffspaced.ingest backend/audio_in --out backend/riffs_out --tuning "Bb Standard"`, open the results in the app via Import, and write `docs/benchmarks/real-audio-notes.md` describing what worked and what did not (no audio files committed). If the folder is empty: write the HARD STOP question into STATUS.md ("Drop WAV/FLAC riff recordings into backend/audio_in and say continue, or say skip"), commit, push, and stop. On "skip", add to BACKLOG and proceed.

Commit: `docs(analysis): record first results on real recordings` (or the BACKLOG entry).

## P6.T11 Chrome verification and phase exit

Chrome verification script (backend running on 8000):
1. Open http://localhost:5173; status bar shows `backend: ok`.
2. File > Import from audio; choose `backend/debug/walkdown.wav` (rendered by the synth CLI); wait; the imported riff opens; screenshot. Expect the bar 4 walkdown visible, mostly green, some amber.
3. Press Space; it plays. Compare by ear is not possible; instead open the original demo riff and the import side by side in split view (both 4 bars), screenshot both for the docs.
4. Stop the backend; within 15 s the status bar shows `backend: unreachable` and the AI and Import menu items are disabled with the reason. Restart it. Console clean.

Docs: `docs/ANALYSIS_METHOD.md` complete with the benchmark table pasted; `docs/LEARNING_LOG.md` Phase 6 entry. `STATUS.md`, tag `v0.6.0`, push, CI green (backend tests must stay under 3 minutes in CI; mark the full benchmark as a manual `make bench` target, with a 2-riff smoke version in `pytest`), `/compact`.

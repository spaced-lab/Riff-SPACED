# Phase 4: Playback

Goal: press Space and hear the riff with a basic synth voice while the fretboard flashes each note in time, the playhead sweeps the tab lanes, and the loop wraps cleanly at 4/8/12/16 bars. Count-in, metronome, section solo, and the four-way split view also land here.

Read first: SPEC 6 (all), 5.5, 5.6; DECISIONS 8, 14.

## P4.T1 Audio engine core (no React)

Files under `frontend/src/audio/`: `context.ts` (lazy `AudioContext` created on first user gesture, `resume()`, exposes `now()`), `clock.ts` (tick/seconds conversion bound to a tempo, `positionAt(audioTime)`), `scheduler.ts` (lookahead scheduler per SPEC 6.1: `start(riff, loop, atTick)`, `stop()`, `setTempo(bpm)`, emits `noteOn/noteOff/click` events into a voice sink and a visual queue), `events.ts` (tiny typed emitter), `types.ts`.

The scheduler must be testable with a fake clock: inject `{ now(): number, setInterval, clearInterval }`. Tests: with a 4-bar riff at 120 BPM, after advancing fake time by 8 s, every note was scheduled exactly once per loop pass with correct times (tolerance 1e-6), and loop wrap schedules the first notes of pass 2 before pass 1 ends.

Commit: `feat(audio): add lookahead scheduler with injectable clock and visual event queue`.

## P4.T2 Voices

`audio/voices/basic.ts` per SPEC 6.2 (two oscillators, biquad, ADSR, palmMute/letRing/dead handling, velocity), `audio/voices/metronome.ts`, `audio/master.ts` (gain, compressor, polyphony cap 12 with oldest-voice stealing), `audio/voices/types.ts` (`Voice` interface: `noteOn(pitch, velocity, time, techniques)`, `noteOff(handle, time)`).

Unit tests use a minimal fake `AudioContext` (`audio/testing/fakeAudioContext.ts`) that records node graph construction and parameter schedules; assert the ADSR ramp times and that palmMute shortens decay.

Stretch (do it if the above took less than the whole task budget, otherwise Phase 8): `audio/voices/heavy.ts` per SPEC 6.2.

Commit: `feat(audio): add basic synth voice, metronome click, and master bus with polyphony cap`.

## P4.T3 Transport and store integration

- `store/transportSlice.ts`: `isPlaying`, `bpm`, `loopEnabled`, `countIn`, `metronome`, `voice: 'basic' | 'heavy'`, `soloSectionId`, `positionTick` (updated at most 30 times per second for the readout; the playhead uses the ref path, not this).
- `audio/engine.ts`: singleton that subscribes to the store (riff changes restart scheduling at the current tick without a click; bpm changes restart in place), wires voices, and drains the visual queue in a `requestAnimationFrame` loop: sets `highlightIds` (batched per frame), calls `playheadRef.setX(tick)`.
- Transport UI (`transport/Transport.tsx`): per SPEC 5.6, replaces the placeholder bar. Position readout `bar.beat.tick` 1-based.
- Count-in: one bar of metronome before tick 0, during which the playhead sits at 0 and the readout shows `count-in 1..4`.
- Section solo: loop region becomes the section's bar range.
- Browser autoplay: the first Play click resumes the context; if it is suspended, the Play button shows `tap to enable audio` once.

Tests: transport reducer; engine integration test with the fake clock and fake context asserting highlight ids change in time order.

Commit: `feat(playback): wire transport, engine, loop, count-in, metronome, and section solo`.

## P4.T4 Visual sync: fretboard flash and playhead

- Fretboard shows notes sounding at `positionTick` while playing (switches from edit-cursor view automatically; returns to edit view on stop). Sounding dots use the flash class; chord connectors flash too.
- Playhead `<line>` moves via ref every frame; the tab container auto-scrolls to keep the playhead within the middle 60 percent when "Follow playhead" (View) is on, default on.
- Measure jitter: in dev builds, log the max difference between scheduled audio time and the frame time the highlight was applied, visible in the status bar as `sync ±N ms`. Target under 25 ms.

Playwright: start playback, wait 600 ms, screenshot (`docs/screenshots/phase-04/playing.png`), assert at least one dot has the sounding class and the playhead x advanced; stop; assert playhead resets to the edit cursor. Use `page.evaluate` to read `AudioContext.state` and assert `running`.

Commit: `feat(playback): sync fretboard highlighting and tab playhead to the audio clock`.

## P4.T5 Four-way split view

`fretboard/SplitView.tsx` per SPEC 5.5: 2x2 mini fretboards, each a `Fretboard` with notes filtered to its bar range, quadrant title `bars 1-4` etc., active quadrant outlined bright during playback, sounding notes flash within their quadrant. View menu toggle (dev toolbar for now). Loop length changes re-split.

Playwright: enable split view with the 16-bar demo-derived riff (duplicate the demo to 16 bars in the test), play, screenshot, assert exactly one quadrant has the active class.

Commit: `feat(view): add four-way split fretboard view synced to playback`.

## P4.T6 Offline render and non-silence test

`audio/render.ts`: `renderRiffToWav(riff, voice, bars)` with `OfflineAudioContext`, encodes 16-bit PCM WAV (`export/wav.ts`, hand-written header writer with tests on the header bytes). Playwright test renders the demo riff and asserts RMS above a threshold and that the first onset is within 20 ms of tick 0. This test exists so playback regressions are caught without ears.

Commit: `feat(audio): add offline render to WAV with a non-silence e2e check`.

## P4.T7 Chrome verification and phase exit

Chrome verification script:
1. Open http://localhost:5173, load "Walkdown Turnaround".
2. Press Space. Screenshot twice 1 s apart. Expect: dots flashing on the lowest two strings, playhead moving, readout advancing `1.1.0 → 1.3.x → ...`, loop returns to bar 1 after bar 4. No audible test possible; rely on the readout and the WAV test.
3. Turn on count-in and metronome; press Space; readout shows `count-in`.
4. Click section A in the inspector to solo; loop region shades; playback stays within it.
5. Change BPM from 92 to 140 during playback; no exceptions in console; playhead speeds up.
6. View > Split view; screenshot; one active quadrant.
7. Stop. Console clean. Record `sync ±N ms` from the status bar in the commit TEST line.

Docs: `docs/AUDIO_ENGINE.md` (the two-clocks problem, lookahead scheduler diagram, why visuals read the audio clock, voice graph diagram). `docs/LEARNING_LOG.md` Phase 4 entry. `STATUS.md`, tag `v0.4.0`, push, CI green, `/compact`.

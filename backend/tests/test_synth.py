import json

import numpy as np
import pytest

from riffspaced.music.time import TICKS_PER_BAR, ticks_to_seconds
from riffspaced.paths import FIXTURES_DIR
from riffspaced.synth import (
    LET_RING_TAIL,
    damping_for,
    karplus_strong,
    render_click_track,
    render_riff,
)


def spectrum(x, sr):
    window = np.hanning(len(x))
    mag = np.abs(np.fft.rfft(x * window))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    return freqs, mag


def band_energy(freqs, mag, center, width=4.0):
    sel = (freqs > center - width) & (freqs < center + width)
    return float(np.sum(mag[sel] ** 2))


def single_note_riff(fret=0, techniques=None, bpm=120):
    return {
        "format": "riff-spaced/riff",
        "version": 1,
        "id": "t",
        "name": "one",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
        "tuning": {"name": "Bb Standard", "pitches": [34, 39, 44, 49, 53, 58]},
        "tempo": {"bpm": bpm},
        "timeSignature": {"beats": 4, "unit": 4},
        "ppq": 480,
        "lengthBars": 1,
        "sections": [{"id": "s", "label": "A", "startBar": 0, "lengthBars": 1, "kind": "main"}],
        "notes": [
            {
                "id": "n",
                "string": 6,
                "fret": fret,
                "start": 0,
                "duration": 1920,
                "velocity": 100,
                "techniques": techniques or [],
            }
        ],
    }


def test_rendered_length_matches_the_loop_plus_tail(demo_library):
    riff = demo_library["riffs"][0]
    audio, truth = render_riff(riff, drive=6.0)
    expected = (
        ticks_to_seconds(riff["lengthBars"] * TICKS_PER_BAR, riff["tempo"]["bpm"]) + LET_RING_TAIL
    )
    assert len(audio) / 44100 == pytest.approx(expected, abs=0.01)
    assert len(truth) == 56
    assert truth[0].pitch == 34 and truth[0].start_seconds == 0.0
    assert np.max(np.abs(audio)) == pytest.approx(0.9, abs=1e-3)


def test_single_note_spectrum_peaks_at_f0_within_one_percent():
    audio, _ = render_riff(single_note_riff(fret=0), drive=1.0, noise_db=-200)
    seg = audio[int(0.1 * 44100) : int(1.6 * 44100)]
    freqs, mag = spectrum(seg, 44100)
    low = freqs < 500
    peak = freqs[low][np.argmax(mag[low])]
    assert abs(peak - 58.2705) / 58.2705 < 0.01
    audio3, _ = render_riff(single_note_riff(fret=3), drive=1.0, noise_db=-200)
    freqs, mag = spectrum(audio3[int(0.1 * 44100) : int(1.6 * 44100)], 44100)
    peak3 = freqs[low][np.argmax(mag[low])]
    assert abs(peak3 - 69.2957) / 69.2957 < 0.01


def dyad_riff():
    riff = single_note_riff(fret=3)
    riff["notes"] = [
        {
            "id": "a",
            "string": 6,
            "fret": 3,
            "start": 0,
            "duration": 1920,
            "velocity": 100,
            "chordId": "c",
        },
        {
            "id": "b",
            "string": 5,
            "fret": 5,
            "start": 0,
            "duration": 1920,
            "velocity": 100,
            "chordId": "c",
        },
    ]
    return riff


def test_drive_creates_intermodulation_and_brightens_the_spectrum():
    """The point of the amp: distortion adds energy where neither string has a harmonic.

    A Db2 + Ab2 power chord (69.3 and 103.8 Hz) through tanh gains a sum tone at 173.1 Hz,
    which is 2.5 times one fundamental and 5/3 of the other: a harmonic of neither. Naive
    pitch trackers read such tones as notes; the matcher in P6.T5 models them instead.
    """
    f1, f2 = 69.2957, 103.8262

    def measure(drive):
        audio, _ = render_riff(dyad_riff(), drive=drive, noise_db=-200)
        seg = audio[int(0.05 * 44100) : int(1.0 * 44100)]
        freqs, mag = spectrum(seg, 44100)
        fundamental = band_energy(freqs, mag, f1, width=3.0)
        sum_tone = band_energy(freqs, mag, f1 + f2, width=3.0)
        centroid = float(np.sum(freqs * mag) / np.sum(mag))
        return sum_tone / fundamental, centroid

    clean_ratio, clean_centroid = measure(0.5)
    heavy_ratio, heavy_centroid = measure(12.0)
    assert heavy_ratio > clean_ratio * 3
    assert heavy_centroid > clean_centroid


def test_palm_mute_decays_much_faster_than_open():
    assert damping_for(58.27, 2.5) > damping_for(58.27, 0.12)
    ring = karplus_strong(58.27, 1.0, ring_seconds=2.5)
    muted = karplus_strong(58.27, 1.0, ring_seconds=0.12)
    late = slice(int(0.3 * 44100), int(0.4 * 44100))
    early = slice(0, int(0.05 * 44100))
    ring_drop = np.sqrt(np.mean(ring[late] ** 2)) / np.sqrt(np.mean(ring[early] ** 2))
    mute_drop = np.sqrt(np.mean(muted[late] ** 2)) / np.sqrt(np.mean(muted[early] ** 2))
    assert mute_drop < 0.01
    assert ring_drop > 0.2
    with pytest.raises(ValueError):
        karplus_strong(30000.0, 0.1)


def test_dead_notes_and_click_track_and_cli(tmp_path, demo_library):
    audio, truth = render_riff(single_note_riff(techniques=["dead"]), drive=4.0)
    assert truth[0].palm_mute is False
    assert np.max(np.abs(audio[: int(0.05 * 44100)])) > 0.1
    assert np.max(np.abs(audio[int(0.5 * 44100) :])) < 0.05
    clicks = render_click_track(120, 2)
    peaks = np.where(np.abs(clicks) > 0.5)[0]
    assert peaks[0] < 50
    assert len(clicks) >= int(4.0 * 44100)

    from riffspaced.synth import _main

    lib = tmp_path / "lib.json"
    lib.write_text(json.dumps(demo_library))
    out = tmp_path / "walkdown.wav"
    assert (
        _main([str(lib), "--riff", "Walkdown Turnaround", "--out", str(out), "--drive", "8"]) == 0
    )
    assert out.stat().st_size > 44100
    with pytest.raises(SystemExit):
        _main([str(lib), "--riff", "Nope", "--out", str(out)])
    assert (FIXTURES_DIR / "demo-library.json").exists()

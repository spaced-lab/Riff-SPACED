"""Scoring helpers shared by the tests and the benchmark (SPEC 8.3): onset F1 and friends."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class F1:
    """Precision, recall and F1 with the matched pairs."""

    precision: float
    recall: float
    f1: float
    matches: list[tuple[int, int]]


def match_events(truth: np.ndarray, found: np.ndarray, window: float) -> list[tuple[int, int]]:
    """Greedy one-to-one matching of sorted times within `window` seconds."""
    truth = np.asarray(truth, dtype=float)
    found = np.asarray(found, dtype=float)
    used = np.zeros(len(found), dtype=bool)
    matches: list[tuple[int, int]] = []
    for i, t in enumerate(truth):
        if len(found) == 0:
            break
        diffs = np.abs(found - t)
        diffs[used] = np.inf
        j = int(np.argmin(diffs))
        if diffs[j] <= window:
            used[j] = True
            matches.append((i, j))
    return matches


def onset_f1(truth: np.ndarray, found: np.ndarray, window: float = 0.03) -> F1:
    """F1 of found onsets against true onsets within a time window."""
    matches = match_events(truth, found, window)
    tp = len(matches)
    precision = tp / len(found) if len(found) else 0.0
    recall = tp / len(truth) if len(truth) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0.0
    return F1(precision, recall, f1, matches)


@dataclass(frozen=True)
class NoteScores:
    """Note-level scores against rendered ground truth."""

    onset_f1: float
    note_f1: float
    fingering_accuracy: float
    dyad_accuracy: float
    matched: int
    truth_count: int
    found_count: int


def score_notes(truth: list, riff: dict, bpm: float, window: float = 0.03) -> NoteScores:
    """Compare a riff dict against RenderedNote ground truth.

    Note F1 matches by pitch and onset time; fingering accuracy is the share of matched notes
    on the right string and fret; dyad accuracy is the share of true chords whose members were
    all found at the right positions.
    """
    from riffspaced.music.time import ticks_to_seconds
    from riffspaced.music.tuning import Tuning, pitch_of

    tuning = Tuning.from_dict(riff["tuning"])
    found = []
    for n in riff["notes"]:
        found.append(
            (
                ticks_to_seconds(n["start"], bpm),
                pitch_of(tuning, n["string"], n["fret"]),
                n["string"],
                n["fret"],
                n.get("chordId"),
            )
        )
    truth_list = [(t.start_seconds, t.pitch, t.string, t.fret) for t in truth]
    used = [False] * len(found)
    matches = []
    for i, (ts, tp, _, _) in enumerate(truth_list):
        best, best_d = None, window
        for j, (fs, fp, _, _, _) in enumerate(found):
            if used[j] or fp != tp:
                continue
            d = abs(fs - ts)
            if d <= best_d:
                best, best_d = j, d
        if best is not None:
            used[best] = True
            matches.append((i, best))
    tp = len(matches)
    precision = tp / len(found) if found else 0.0
    recall = tp / len(truth_list) if truth_list else 0.0
    note_f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fingering = (
        sum(
            1
            for i, j in matches
            if (truth_list[i][2], truth_list[i][3]) == (found[j][2], found[j][3])
        )
        / tp
        if tp
        else 0.0
    )
    truth_onsets = np.array(sorted({round(t, 4) for t, _, _, _ in truth_list}))
    found_onsets = np.array(sorted({round(f, 4) for f, _, _, _, _ in found}))
    onset = onset_f1(truth_onsets, found_onsets, window).f1
    # Dyads: group truth by start time with more than one note.
    by_start: dict[float, list[tuple[float, int, int, int]]] = {}
    for t in truth_list:
        by_start.setdefault(round(t[0], 4), []).append(t)
    chords = [group for group in by_start.values() if len(group) > 1]
    matched_pairs = dict(matches)
    hit = 0
    for group in chords:
        idxs = [truth_list.index(g) for g in group]
        if all(
            i in matched_pairs
            and (truth_list[i][2], truth_list[i][3])
            == (found[matched_pairs[i]][2], found[matched_pairs[i]][3])
            for i in idxs
        ):
            hit += 1
    dyad = hit / len(chords) if chords else 1.0
    return NoteScores(
        round(onset, 3),
        round(note_f1, 3),
        round(fingering, 3),
        round(dyad, 3),
        tp,
        len(truth_list),
        len(found),
    )

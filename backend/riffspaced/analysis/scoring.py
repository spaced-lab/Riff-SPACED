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

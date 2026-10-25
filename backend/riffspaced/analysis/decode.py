"""Stage 8: decode (SPEC 8.2 step 8).

The matcher scores every candidate for every segment independently. A riff is not
independent events: a hand mostly stays where it is, repeats the shape it just played, and
moves a fret or two rather than seven. Viterbi decoding finds the sequence of candidates
that maximizes the summed similarity minus the cost of the hand movements between them.

Transition cost between consecutive candidates (SPEC P6.T6):
    0.08 * fret distance of the lowest fretted finger
  + 0.05 if the set of strings changes
  - 0.10 if the shape is exactly the previous shape (riffs repeat)
Silence costs nothing to enter or leave: the hand does not move to be quiet.

Emissions are the cosine scores rescaled: `(score - best_in_segment) / EMISSION_TEMPERATURE`,
so the best candidate of a segment sits at 0 and the others fall off by their margin in
units a transition cost can be compared with. Without that rescaling the repeat bonus
(0.10) dwarfed real margins (about 0.02) and the path locked onto one shape for a whole file.

The per-segment confidence is the margin between the chosen candidate's score and the best
candidate with different pitches, normalized by the largest margin seen so far in the file,
so a clean take with wide margins and a muddy one with narrow margins both map to 0..1.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from riffspaced.analysis.fingering_match import Candidate
from riffspaced.music.fingering import hand_position

FRET_COST = 0.08
STRING_COST = 0.05
REPEAT_BONUS = 0.10
MIN_MARGIN_SCALE = 0.02
EMISSION_TEMPERATURE = 0.01


@dataclass(frozen=True)
class Decoded:
    """Chosen candidate index per segment, with confidences and margins."""

    path: list[int]
    confidences: list[float]
    margins: list[float]


def transition_matrix(candidates: list[Candidate]) -> np.ndarray:
    """cost[i, j] of moving from candidate i to candidate j."""
    n = len(candidates)
    positions = [hand_position(c.positions) if not c.is_silence else None for c in candidates]
    strings = [frozenset(p.string for p in c.positions) for c in candidates]
    cost = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        for j in range(n):
            if i == j:
                cost[i, j] = -REPEAT_BONUS if not candidates[i].is_silence else -REPEAT_BONUS * 0.5
                continue
            if positions[i] is None or positions[j] is None:
                continue
            cost[i, j] = FRET_COST * abs(positions[i] - positions[j]) + (
                STRING_COST if strings[i] != strings[j] else 0.0
            )
    return cost


def _margins(scores: np.ndarray, candidates: list[Candidate], path: list[int]) -> list[float]:
    margins = []
    pitch_sets = [frozenset(c.pitches) for c in candidates]
    for t, j in enumerate(path):
        row = scores[t]
        chosen = pitch_sets[j]
        others = [row[k] for k in range(len(candidates)) if pitch_sets[k] != chosen]
        margins.append(float(row[j] - max(others)) if others else 1.0)
    return margins


def viterbi(
    scores: np.ndarray, candidates: list[Candidate], transitions: np.ndarray | None = None
) -> Decoded:
    """Best candidate path through the score matrix (segments by candidates)."""
    segments, n = scores.shape
    if segments == 0:
        return Decoded([], [], [])
    cost = transitions if transitions is not None else transition_matrix(candidates)
    emissions = (scores - scores.max(axis=1, keepdims=True)) / EMISSION_TEMPERATURE
    best = emissions[0].astype(np.float64).copy()
    back = np.zeros((segments, n), dtype=np.int64)
    for t in range(1, segments):
        # total[i, j] = best[i] - cost[i, j]: the best way to arrive at j from any i.
        total = best[:, None] - cost
        back[t] = np.argmax(total, axis=0)
        best = total[back[t], np.arange(n)] + emissions[t]
    path = [int(np.argmax(best))]
    for t in range(segments - 1, 0, -1):
        path.append(int(back[t, path[-1]]))
    path.reverse()
    margins = _margins(scores, candidates, path)
    confidences = []
    running = MIN_MARGIN_SCALE
    for m in margins:
        running = max(running, m)
        confidences.append(
            float(np.clip(0.5 + 0.5 * m / running, 0.0, 1.0))
            if m > 0
            else float(np.clip(0.5 + 0.5 * m / MIN_MARGIN_SCALE, 0.0, 0.5))
        )
    return Decoded(path, confidences, margins)

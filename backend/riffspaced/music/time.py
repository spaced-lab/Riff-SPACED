"""Musical time in integer ticks (SPEC 3.4). 480 PPQ, 4/4 only in v1."""

from __future__ import annotations

from dataclasses import dataclass

PPQ = 480
BEATS_PER_BAR = 4
TICKS_PER_BEAT = PPQ
TICKS_PER_BAR = PPQ * BEATS_PER_BAR

GRID: dict[str, int] = {"1/4": 480, "1/8": 240, "1/16": 120, "1/8T": 160, "1/16T": 80}
LOOP_LENGTHS = (4, 8, 12, 16)


def ticks_to_seconds(ticks: float, bpm: float) -> float:
    """`ticks / PPQ` quarter notes times `60 / bpm` seconds per quarter note."""
    return ticks / PPQ * 60.0 / bpm


def seconds_to_ticks(seconds: float, bpm: float) -> float:
    """Inverse of ticks_to_seconds; callers round when storing."""
    return seconds * bpm * PPQ / 60.0


@dataclass(frozen=True)
class BarBeatTick:
    """1-based bar and beat, tick within the beat."""

    bar: int
    beat: int
    tick: int


def bar_beat_tick(ticks: int) -> BarBeatTick:
    """Position readout: tick 2520 is bar 2, beat 2, tick 120."""
    t = max(0, int(ticks))
    return BarBeatTick(
        bar=t // TICKS_PER_BAR + 1,
        beat=(t % TICKS_PER_BAR) // TICKS_PER_BEAT + 1,
        tick=t % TICKS_PER_BEAT,
    )


def format_position(ticks: int) -> str:
    """`02.2.120` style readout."""
    p = bar_beat_tick(ticks)
    return f"{p.bar:02d}.{p.beat}.{p.tick:03d}"


def snap_to_grid(ticks: float, grid: str | int) -> int:
    """Nearest grid point; exact halves round up (matching JavaScript's Math.round)."""
    step = grid if isinstance(grid, int) else GRID[grid]
    return int((ticks / step) + 0.5) * step if ticks >= 0 else -snap_to_grid(-ticks, step)


def bars_to_ticks(bars: int) -> int:
    """Whole bars to ticks."""
    return bars * TICKS_PER_BAR

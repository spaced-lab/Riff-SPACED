"""Music conventions (SPEC section 3), mirroring frontend/src/music.

Both implementations are tested against shared/fixtures/music-conventions.json.
"""

from riffspaced.music.dyad import INTERVAL_MEANING, DyadInfo, describe_dyad
from riffspaced.music.fingering import (
    FINGERING_COST,
    MAX_SPAN,
    Position,
    best_fingering,
    find_fingerings,
    hand_position,
    hand_span,
)
from riffspaced.music.naming import FLAT_NAMES, SHARP_NAMES, name_of
from riffspaced.music.pitch import freq_of, octave_of, pitch_class
from riffspaced.music.time import (
    GRID,
    LOOP_LENGTHS,
    PPQ,
    TICKS_PER_BAR,
    TICKS_PER_BEAT,
    bar_beat_tick,
    format_position,
    seconds_to_ticks,
    snap_to_grid,
    ticks_to_seconds,
)
from riffspaced.music.tuning import (
    ALL_PRESETS,
    DEFAULT_TUNING,
    DROP_PRESETS,
    STANDARD_PRESETS,
    Tuning,
    drop_of,
    is_valid_tuning,
    pitch_of,
    preset_by_name,
    retune_string,
)

__all__ = [
    "ALL_PRESETS",
    "DEFAULT_TUNING",
    "DROP_PRESETS",
    "FINGERING_COST",
    "FLAT_NAMES",
    "GRID",
    "INTERVAL_MEANING",
    "LOOP_LENGTHS",
    "MAX_SPAN",
    "PPQ",
    "SHARP_NAMES",
    "STANDARD_PRESETS",
    "TICKS_PER_BAR",
    "TICKS_PER_BEAT",
    "DyadInfo",
    "Position",
    "Tuning",
    "bar_beat_tick",
    "best_fingering",
    "describe_dyad",
    "drop_of",
    "find_fingerings",
    "format_position",
    "freq_of",
    "hand_position",
    "hand_span",
    "is_valid_tuning",
    "name_of",
    "octave_of",
    "pitch_class",
    "pitch_of",
    "preset_by_name",
    "retune_string",
    "seconds_to_ticks",
    "snap_to_grid",
    "ticks_to_seconds",
]

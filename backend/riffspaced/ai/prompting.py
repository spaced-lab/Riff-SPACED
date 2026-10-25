"""Prompt files and how they become system prompts (SPEC 9.1, Phase 7).

Each file in `prompts/` starts with a `promptVersion: N` line. The task prompts (analyze,
suggest, cleanup) are templates: `{{STYLE_DIRECTIVE}}`, `{{TUNING_TABLE}}`, `{{DYAD_TABLE}}`
and `{{RIFF_SCHEMA}}` are filled at load time from the single sources of truth (the directive
file, the tuning presets, the dyad labels, `shared/schema/riff.schema.json`), so the prompt can
never drift from the code that validates the answers (DECISIONS 56).

The version travels with every answer as `source.promptVersion`, which is how a riff made
by the AI can be traced back to the exact wording that produced it.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from riffspaced.music.dyad import INTERVAL_MEANING, LABELS
from riffspaced.music.naming import name_of
from riffspaced.music.tuning import ALL_PRESETS
from riffspaced.paths import SCHEMA_DIR

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
TASKS = ("analyze", "suggest", "cleanup")

_HEADER = re.compile(r"^promptVersion:\s*(\d+)\s*$")
_PLACEHOLDER = re.compile(r"\{\{([A-Z_]+)\}\}")


@dataclass(frozen=True)
class Prompt:
    """A rendered system prompt and the version of the file it came from."""

    name: str
    version: int
    text: str


def read_prompt_file(path: Path) -> tuple[int, str]:
    """Split a prompt file into its version number and body.

    The header is the first line and nothing else goes before it; a file without one is a
    bug in the repo, not a runtime condition, so it raises.
    """
    lines = path.read_text(encoding="utf-8").splitlines()
    match = _HEADER.match(lines[0]) if lines else None
    if match is None:
        raise ValueError(f"{path.name}: first line must be 'promptVersion: N'")
    return int(match.group(1)), "\n".join(lines[1:]).strip() + "\n"


@lru_cache(maxsize=1)
def style_directive() -> Prompt:
    """The owner's directive, verbatim, as the body of `style_directive.md`."""
    version, body = read_prompt_file(PROMPTS_DIR / "style_directive.md")
    return Prompt("style_directive", version, body.strip())


def tuning_table() -> str:
    """Every preset as a markdown table: name, open strings low to high, MIDI numbers."""
    rows = ["| Tuning | Open strings (low to high) | MIDI |", "|---|---|---|"]
    for tuning in ALL_PRESETS:
        names = " ".join(name_of(p) for p in tuning.pitches)
        midi = " ".join(str(p) for p in tuning.pitches)
        rows.append(f"| {tuning.name} | {names} | {midi} |")
    return "\n".join(rows)


def dyad_table() -> str:
    """The interval labels (SPEC 3.5) with what they usually mean in this music."""
    rows = ["| Semitones | Label | Meaning here |", "|---|---|---|"]
    for semitones, label in enumerate(LABELS):
        rows.append(f"| {semitones} | {label} | {INTERVAL_MEANING[label]} |")
    rows.append(f"| 12 | P8 | {INTERVAL_MEANING['P8']} |")
    return "\n".join(rows)


def riff_schema_text() -> str:
    """The riff JSON schema, pretty printed, exactly as the backend validates it."""
    schema = json.loads((SCHEMA_DIR / "riff.schema.json").read_text(encoding="utf-8"))
    return json.dumps(schema, indent=2)


def _fill(template: str, values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            raise ValueError(f"unknown prompt placeholder {{{{{key}}}}}")
        return values[key]

    return _PLACEHOLDER.sub(replace, template)


@lru_cache(maxsize=len(TASKS))
def load_prompt(task: str) -> Prompt:
    """Render the system prompt for `task` (analyze, suggest or cleanup)."""
    if task not in TASKS:
        raise ValueError(f"unknown prompt {task!r}; expected one of {', '.join(TASKS)}")
    version, body = read_prompt_file(PROMPTS_DIR / f"{task}.md")
    text = _fill(
        body,
        {
            "STYLE_DIRECTIVE": style_directive().text,
            "TUNING_TABLE": tuning_table(),
            "DYAD_TABLE": dyad_table(),
            "RIFF_SCHEMA": riff_schema_text(),
        },
    )
    return Prompt(task, version, text)

"""Stage 10: emit (SPEC 8.2 step 10). Quantized events become a riff JSON plus a report."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from riffspaced.analysis.quantize import QuantizedEvent, loop_length_bars
from riffspaced.analysis.tempo import TempoCandidate
from riffspaced.model.validate import validate_riff
from riffspaced.music.tuning import Tuning

ANALYSIS_VERSION = "0.6.0"
LOW_CONFIDENCE = 0.6


@dataclass
class Report:
    """What the importer should know: tempo candidates, confidence, warnings, timings."""

    bpm: float
    bpm_candidates: list[TempoCandidate]
    bpm_overridden: bool
    note_count: int
    mean_confidence: float
    low_confidence_count: int
    downbeat_offset_seconds: float
    warnings: list[str] = field(default_factory=list)
    timings: dict[str, float] = field(default_factory=dict)

    def to_markdown(self, name: str) -> str:
        """A short human-readable report for `<name>.report.md` and the import drawer."""
        lines = [f"# {name}", ""]
        source = "overridden by you" if self.bpm_overridden else "detected"
        lines.append(f"- tempo: {self.bpm:.1f} bpm ({source})")
        if self.bpm_candidates:
            cands = ", ".join(f"{c.bpm:.1f} (score {c.score:.2f})" for c in self.bpm_candidates)
            lines.append(f"- tempo candidates: {cands}")
        lines.append(f"- notes: {self.note_count}")
        lines.append(f"- mean confidence: {self.mean_confidence:.2f}")
        lines.append(f"- low confidence (below {LOW_CONFIDENCE}): {self.low_confidence_count}")
        lines.append(f"- downbeat offset: {self.downbeat_offset_seconds * 1000:.0f} ms")
        if self.timings:
            total = sum(self.timings.values())
            parts = ", ".join(f"{k} {v:.2f}s" for k, v in self.timings.items())
            lines.append(f"- time: {total:.2f}s ({parts})")
        if self.warnings:
            lines.append("")
            lines.append("## warnings")
            lines.extend(f"- {w}" for w in self.warnings)
        return "\n".join(lines) + "\n"

    def to_dict(self) -> dict[str, Any]:
        """JSON shape for the API."""
        return {
            "bpm": self.bpm,
            "bpmCandidates": [{"bpm": c.bpm, "score": c.score} for c in self.bpm_candidates],
            "bpmOverridden": self.bpm_overridden,
            "noteCount": self.note_count,
            "meanConfidence": self.mean_confidence,
            "lowConfidenceCount": self.low_confidence_count,
            "downbeatOffsetSeconds": self.downbeat_offset_seconds,
            "warnings": list(self.warnings),
            "timings": dict(self.timings),
        }


def build_riff(
    events: list[QuantizedEvent],
    tuning: Tuning,
    bpm: float,
    name: str,
    audio_file: str,
    bpm_detected: float,
) -> dict[str, Any]:
    """Assemble and validate the riff dict (SPEC 4.1) with `source.type = "audio"`."""
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    length_bars = loop_length_bars(events)
    loop_end = length_bars * 1920
    notes: list[dict[str, Any]] = []
    for k, e in enumerate(events):
        chord_id = f"c{k}" if len(e.candidate.positions) > 1 else None
        duration = max(1, min(e.duration_ticks, loop_end - e.start_tick))
        for m, pos in enumerate(e.candidate.positions):
            note: dict[str, Any] = {
                "id": f"n{k}-{m}",
                "string": pos.string,
                "fret": pos.fret,
                "start": e.start_tick,
                "duration": duration,
                "velocity": max(1, min(127, e.velocity)),
                "confidence": round(float(e.confidence), 3),
            }
            if e.palm_mute:
                note["techniques"] = ["palmMute"]
            if chord_id:
                note["chordId"] = chord_id
            notes.append(note)
    riff = {
        "format": "riff-spaced/riff",
        "version": 1,
        "id": str(uuid.uuid4()),
        "name": name,
        "createdAt": now,
        "updatedAt": now,
        "tuning": tuning.to_dict(),
        "tempo": {"bpm": round(float(bpm), 2)},
        "timeSignature": {"beats": 4, "unit": 4},
        "ppq": 480,
        "lengthBars": length_bars,
        "sections": [
            {"id": "main", "label": "A", "startBar": 0, "lengthBars": length_bars, "kind": "main"}
        ],
        "notes": notes,
        "tags": ["imported"],
        "source": {
            "type": "audio",
            "audioFile": audio_file,
            "analysisVersion": ANALYSIS_VERSION,
            "bpmDetected": round(float(bpm_detected), 2),
        },
    }
    validate_riff(riff)
    return riff


def build_report(
    events: list[QuantizedEvent],
    bpm: float,
    candidates: list[TempoCandidate],
    overridden: bool,
    offset: float,
    warnings: list[str],
    timings: dict[str, float],
) -> Report:
    """Summarize the run."""
    confidences = [e.confidence for e in events]
    mean = float(sum(confidences) / len(confidences)) if confidences else 0.0
    low = sum(1 for c in confidences if c < LOW_CONFIDENCE)
    return Report(
        bpm=round(float(bpm), 2),
        bpm_candidates=candidates,
        bpm_overridden=overridden,
        note_count=sum(len(e.candidate.positions) for e in events),
        mean_confidence=round(mean, 3),
        low_confidence_count=low,
        downbeat_offset_seconds=round(float(offset), 4),
        warnings=warnings,
        timings=timings,
    )

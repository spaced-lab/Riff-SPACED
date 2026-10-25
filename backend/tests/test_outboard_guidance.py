import json

from riffspaced.model.validate import validate_riff
from riffspaced.paths import REPO_DIR, SCHEMA_DIR

GUIDANCE = REPO_DIR / "outboard-guidance"


def test_example_riff_validates_and_looks_imported():
    riff = json.loads((GUIDANCE / "example.riff.json").read_text())
    validate_riff(riff)
    assert riff["source"]["type"] == "audio"
    assert riff["source"]["analysisVersion"].startswith("outboard/")
    assert "outboard" in riff["tags"]
    assert all("confidence" in n for n in riff["notes"])


def test_schema_copy_matches_the_canonical_schema():
    copy = json.loads((GUIDANCE / "riff.schema.json").read_text())
    canonical = json.loads((SCHEMA_DIR / "riff.schema.json").read_text())
    assert copy == canonical


def test_guide_covers_the_rules_and_has_no_em_dashes():
    text = (GUIDANCE / "OUTBOARD_ANALYSIS_GUIDE.md").read_text()
    for needle in (
        "480 ticks per quarter note",
        "pitches[N - string] + fret",
        "string 1 is the highest",
        "chordId",
        "palmMute",
        "confidence",
        "injest-riff-JSON",
        "at most 4 frets",
        "[34, 39, 44, 49, 53, 58]",
    ):
        assert needle in text, needle
    assert "—" not in text
    minimal = text.split("## 6. Minimal valid riff")[1].split("```json")[1].split("```")[0]
    validate_riff(json.loads(minimal))

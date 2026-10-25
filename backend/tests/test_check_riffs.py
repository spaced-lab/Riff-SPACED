import json
import shutil

from riffspaced.check_riffs import check_file, main, summarize_riff
from riffspaced.paths import REPO_DIR

GUIDANCE = REPO_DIR / "outboard-guidance"


def test_example_file_is_valid_and_summarized():
    result = check_file(GUIDANCE / "example.riff.json")
    assert result.ok and result.kind == "riff", result.problems
    assert "P5 " in result.summary and "P4 " in result.summary
    assert "palm muted: 55" in result.summary
    assert "outboard/your-tool 1.0" in result.summary


def test_summary_flags_what_the_schema_cannot(demo_library):
    riff = json.loads(json.dumps(demo_library["riffs"][0]))
    riff["notes"][0]["fret"] = 14
    riff["notes"][1]["fret"] = 0  # open strings do not count toward a chord span
    riff["notes"][2]["string"] = 1
    riff["notes"][3]["start"] = 485
    riff["notes"][4]["duration"] = 99999
    info = summarize_riff(riff)
    assert info["aboveFret12"] == 1
    assert info["offLowStrings"] == 1
    assert info["offGridStarts"] == 1
    assert info["pastTheEnd"] == 1
    riff["notes"][1]["fret"] = 1
    riff["notes"][2]["string"] = 5
    riff["notes"][2]["fret"] = 9
    assert summarize_riff(riff)["wideChords"] == ["wd-c01 (span 8)"]


def test_main_reports_valid_invalid_and_bundles(tmp_path, demo_library, capsys):
    shutil.copy(GUIDANCE / "example.riff.json", tmp_path / "good.riff.json")
    (tmp_path / "bundle.riffspaced.json").write_text(json.dumps(demo_library))
    (tmp_path / "broken.json").write_text("{not json")
    bad = json.loads((GUIDANCE / "example.riff.json").read_text())
    bad["notes"][1]["start"] = 7
    (tmp_path / "bad-chord.riff.json").write_text(json.dumps(bad))
    (tmp_path / "future.riff.json").write_text(json.dumps({**bad, "version": 99}))
    code = main([str(tmp_path)])
    out = capsys.readouterr().out
    assert code == 1
    assert "done: 2 valid, 3 invalid" in out
    assert "shares chordId" in out
    assert "not readable as JSON" in out
    assert (tmp_path / "good.check.md").exists()
    assert (tmp_path / "bundle.check.md").read_text().count("## ") == 2
    assert not (tmp_path / "broken.check.md").exists()


def test_main_exit_codes(tmp_path, capsys):
    assert main([str(tmp_path / "missing")]) == 2
    assert main([str(tmp_path)]) == 1
    assert "nothing to do" in capsys.readouterr().err

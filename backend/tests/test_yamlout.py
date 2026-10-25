import json

from riffspaced.yamlout import main, riff_to_yaml, yaml_path_for


def test_walkdown_yaml_is_readable_and_complete(demo_library):
    riff = demo_library["riffs"][0]
    text = riff_to_yaml(riff)
    lines = text.splitlines()
    assert lines[1] == 'name: "Walkdown Turnaround"'
    assert 'tuning: "Bb Standard"' in text
    assert "open_strings: {string_6: Bb1, string_5: Eb2, string_4: Ab2, " in text
    assert "string_3: Db3, string_2: F3, string_1: Bb3}" in text
    assert "bpm: 92" in text and "length_bars: 4" in text
    assert '  - {label: A, bars: "1-4", kind: main}' in text
    assert "tags: [sludge, turnaround, palm-mute, demo]" in text
    notes = [line for line in lines if line.startswith("  - {at:")]
    assert len(notes) == 56
    first = '  - {at: "01.1.000", string: 6, fret: 0, name: Bb1, len: 240, vel: 100, '
    assert notes[0] == first + "tech: palmMute, id: wd-n01}"
    second = '{at: "01.1.240", string: 6, fret: 3, name: Db2, len: 240, vel: 100, chord: wd-c01, '
    assert second + "tech: palmMute, id: wd-n02}" in text
    assert "—" not in text


def test_confidence_and_unplayable_appear_when_present(demo_library):
    riff = json.loads(json.dumps(demo_library["riffs"][1]))
    riff["notes"][0]["confidence"] = 0.4567
    riff["notes"][1]["unplayable"] = True
    text = riff_to_yaml(riff)
    assert "conf: 0.46" in text
    assert "unplayable: true" in text


def test_cli_writes_yaml_beside_json(tmp_path, demo_library, capsys):
    src = tmp_path / "take.riff.json"
    src.write_text(json.dumps(demo_library["riffs"][0]))
    (tmp_path / "bad.riff.json").write_text("{nope")
    assert yaml_path_for(src).name == "take.riff.yaml"
    assert main([str(src), str(tmp_path / "bad.riff.json")]) == 1
    out = tmp_path / "take.riff.yaml"
    assert out.exists() and out.read_text().startswith("# RIFF-SPACED riff")
    assert "bad.riff.json" in capsys.readouterr().err

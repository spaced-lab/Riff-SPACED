import json

import numpy as np
import soundfile as sf

from riffspaced.ingest import main
from riffspaced.synth import render_riff


def test_ingest_folder_writes_riffs_and_reports(tmp_path, demo_library, capsys, monkeypatch):
    monkeypatch.setenv("RIFFSPACED_AI_FAKE", "1")
    folder = tmp_path / "audio_in"
    folder.mkdir()
    for riff in demo_library["riffs"]:
        audio, _ = render_riff(riff, drive=5.0, noise_db=-60)
        sf.write(folder / f"{riff['id']}.wav", np.clip(audio, -1, 1), 44100, subtype="PCM_16")
    (folder / "notes.txt").write_text("not audio")
    out = tmp_path / "riffs_out"
    code = main([str(folder), "--out", str(out), "--tuning", "Bb Standard", "--ai"])
    printed = capsys.readouterr().out
    assert code == 0, printed
    assert "change(s)" in printed
    cleaned = sorted(out.glob("*.clean.riff.json"))
    assert [p.name for p in cleaned] == [
        "demo-riff-tritone.clean.riff.json",
        "demo-riff-walkdown.clean.riff.json",
    ]
    assert "AI cleanup" in (out / "demo-riff-walkdown.cleanup.md").read_text()
    assert "model: fake" in (out / "demo-riff-walkdown.cleanup.md").read_text()
    riffs = sorted(p for p in out.glob("*.riff.json") if ".clean." not in p.name)
    reports = sorted(out.glob("*.report.md"))
    assert [p.name for p in riffs] == [
        "demo-riff-tritone.riff.json",
        "demo-riff-walkdown.riff.json",
    ]
    assert len(reports) == 2
    riff = json.loads(riffs[1].read_text())
    assert riff["name"] == "demo-riff-walkdown"
    assert riff["source"]["type"] == "audio"
    assert "tempo" in reports[1].read_text()


def test_ingest_ai_flag_without_a_key_only_prints_a_note(
    tmp_path, demo_library, capsys, monkeypatch
):
    monkeypatch.delenv("RIFFSPACED_AI_FAKE", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    folder = tmp_path / "audio_in"
    folder.mkdir()
    riff = demo_library["riffs"][1]
    audio, _ = render_riff(riff, drive=5.0, noise_db=-60)
    sf.write(folder / "chug.wav", np.clip(audio, -1, 1), 44100, subtype="PCM_16")
    out = tmp_path / "riffs_out"
    assert main([str(folder), "--out", str(out), "--ai"]) == 0
    printed = capsys.readouterr().out
    assert "--ai skipped, ANTHROPIC_API_KEY not set" in printed
    assert not list(out.glob("*.clean.riff.json"))


def test_ingest_exit_codes(tmp_path, capsys):
    assert main([str(tmp_path / "missing")]) == 2
    empty = tmp_path / "empty"
    empty.mkdir()
    assert main([str(empty), "--out", str(tmp_path / "o")]) == 1
    bad = tmp_path / "bad"
    bad.mkdir()
    (bad / "broken.wav").write_bytes(b"RIFF not really a wav")
    assert main([str(bad), "--out", str(tmp_path / "o2")]) == 1
    assert "failed" in capsys.readouterr().out
    assert main([str(bad), "--tuning", "Nope"]) == 2

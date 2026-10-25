import json

import numpy as np
import soundfile as sf

from riffspaced.ingest import main
from riffspaced.synth import render_riff


def test_ingest_folder_writes_riffs_and_reports(tmp_path, demo_library, capsys):
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
    assert "wired in Phase 7" in printed
    riffs = sorted(out.glob("*.riff.json"))
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

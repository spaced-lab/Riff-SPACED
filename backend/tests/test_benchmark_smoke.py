"""The benchmark harness, small enough for CI: two riffs at one setting."""

from tools.benchmark.run import (
    DRIVES,
    NOISES,
    THRESHOLDS,
    load_riffs,
    passes,
    run_matrix,
    summarize,
    to_markdown,
)


def test_smoke_benchmark_meets_thresholds():
    riffs = load_riffs()
    assert len(riffs) >= 6
    rows = run_matrix(riffs[:2], drives=(6.0,), noises=(-60.0,), verbose=False)
    summary = summarize(rows)
    print(summary)
    assert passes(summary) == {k: True for k in THRESHOLDS}
    md = to_markdown(rows, summary, "test")
    assert "| onset F1 |" in md and "Walkdown Turnaround" in md
    assert len(DRIVES) == 3 and len(NOISES) == 2

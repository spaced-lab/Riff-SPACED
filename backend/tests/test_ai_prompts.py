import pytest

from riffspaced.ai import prompting
from riffspaced.paths import REPO_DIR


def spec_directive() -> str:
    for line in (REPO_DIR / "SPEC.md").read_text().splitlines():
        if line.startswith("> My style is heavily chromatic"):
            return line[2:]
    raise AssertionError("directive not found in SPEC.md")


def test_directive_file_is_verbatim_spec_text():
    directive = prompting.style_directive()
    assert directive.version == 1
    assert directive.text == spec_directive()


@pytest.mark.parametrize("task", prompting.TASKS)
def test_task_prompts_render_with_every_source_inlined(task):
    prompt = prompting.load_prompt(task)
    assert prompt.name == task and prompt.version >= 1
    assert spec_directive() in prompt.text
    assert "| Bb Standard | Bb1 Eb2 Ab2 Db3 F3 Bb3 | 34 39 44 49 53 58 |" in prompt.text
    assert "| 5 | P4 | inverted power chord (root on top) |" in prompt.text
    assert '"riff-spaced/riff"' in prompt.text
    assert "{{" not in prompt.text
    assert "JSON" in prompt.text


def test_prompt_files_have_a_version_header(tmp_path):
    bad = tmp_path / "bad.md"
    bad.write_text("no header here\n")
    with pytest.raises(ValueError, match="promptVersion"):
        prompting.read_prompt_file(bad)
    good = tmp_path / "good.md"
    good.write_text("promptVersion: 3\n\nbody\n")
    assert prompting.read_prompt_file(good) == (3, "body\n")


def test_unknown_placeholder_is_an_error():
    with pytest.raises(ValueError, match="placeholder"):
        prompting._fill("hello {{NOPE}}", {})
    with pytest.raises(ValueError, match="unknown prompt"):
        prompting.load_prompt("dance")


def test_no_em_dashes_in_prompts():
    for path in prompting.PROMPTS_DIR.glob("*.md"):
        assert "—" not in path.read_text(), path.name

"""If a section is added to music-conventions.json, both this count and the TypeScript
parity test (frontend/src/music/parity.test.ts) must change. Neither side may skip a section.
"""

from tests.fixture_cases import SECTIONS, total_cases


def test_every_fixture_section_is_consumed(conventions):
    # Every top-level case list in the file must be covered by a SECTIONS entry.
    file_sections = set()
    for key, value in conventions.items():
        if key.startswith("$"):
            continue
        if isinstance(value, list):
            file_sections.add(key)
        elif isinstance(value, dict):
            file_sections.update(k for k, v in value.items() if isinstance(v, list | dict))
    assert file_sections == set(SECTIONS), file_sections ^ set(SECTIONS)


def test_case_count_matches_the_typescript_side():
    assert total_cases() == 93

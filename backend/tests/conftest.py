import json

import pytest

from riffspaced.paths import FIXTURES_DIR


@pytest.fixture(scope="session")
def conventions() -> dict:
    return json.loads((FIXTURES_DIR / "music-conventions.json").read_text())


@pytest.fixture(scope="session")
def demo_library() -> dict:
    return json.loads((FIXTURES_DIR / "demo-library.json").read_text())


@pytest.fixture(scope="session")
def legacy_riff_v0() -> dict:
    return json.loads((FIXTURES_DIR / "legacy" / "riff-v0.json").read_text())

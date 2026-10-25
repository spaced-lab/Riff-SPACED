from riffspaced.paths import FIXTURES_DIR, SCHEMA_DIR, SHARED_DIR


def test_shared_dir_resolves_to_the_repo_shared_folder():
    assert SHARED_DIR.is_dir()
    assert (SHARED_DIR / "schema" / "README.md").is_file()
    assert SCHEMA_DIR == SHARED_DIR / "schema"
    assert FIXTURES_DIR == SHARED_DIR / "fixtures"

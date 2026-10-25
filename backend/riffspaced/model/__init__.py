"""Document model (SPEC section 4): dataclasses, schema validation, migration."""

from riffspaced.model.migrate import (
    MigrationError,
    migrate_any,
    migrate_arrangement,
    migrate_library,
    migrate_riff,
    migrate_song,
)
from riffspaced.model.types import Arrangement, LibraryBundle, Note, Riff, Section, Song
from riffspaced.model.validate import (
    ValidationError,
    validate_arrangement,
    validate_library,
    validate_riff,
    validate_song,
)

__all__ = [
    "Arrangement",
    "LibraryBundle",
    "MigrationError",
    "Note",
    "Riff",
    "Section",
    "Song",
    "ValidationError",
    "migrate_any",
    "migrate_arrangement",
    "migrate_library",
    "migrate_riff",
    "migrate_song",
    "validate_arrangement",
    "validate_library",
    "validate_riff",
    "validate_song",
]

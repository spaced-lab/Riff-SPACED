# Shared JSON Schemas

The riff, arrangement, song, and library bundle formats (SPEC section 4) are defined here as JSON Schema draft 2020-12 files:

- `riff.schema.json`
- `arrangement.schema.json`
- `song.schema.json`
- `library.schema.json`

Both sides of the app validate against these files so the formats cannot drift:

- The frontend (`frontend/src/model/validate.ts`) uses a small hand-written validator that checks the fields that matter, and its tests load the schema files to assert the two agree on enums and ranges. There is no ajv in the browser bundle (DECISIONS 17).
- The backend (`backend/riffspaced/model/validate.py`) validates with the `jsonschema` library against these exact files, then applies the semantic rules JSON Schema cannot express (chord members share a start, sections cover the riff without overlap).

Phase 1 writes the schema files. Changing a format means bumping `version`, adding a migration on both sides, and adding a legacy fixture under `../fixtures/legacy/`.

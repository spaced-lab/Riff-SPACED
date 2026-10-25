# injest-riff-JSON

Drop riff JSON files produced by an outboard tool or another LLM here (the guide they should
follow is in `outboard-guidance/`). Nothing in this folder is committed except this file.

Check what arrived:

```
cd backend
uv run python -m riffspaced.check_riffs ../injest-riff-JSON
```

The checker validates every `*.json` against the schema and the semantic rules, prints a
summary per file (tuning, tempo, bars, notes, dyad histogram, palm mutes, confidence,
playability) and writes `<name>.check.md` next to it. Valid files open in the app with
File > Open, or File > Import library for a bundle.

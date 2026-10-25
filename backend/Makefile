# Backend task runner. `make check` is the gate every backend commit must pass.

UV := $(shell command -v uv 2>/dev/null)

.PHONY: install dev lint format test check

install:
ifdef UV
	uv sync --extra dev
else
	python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
endif

dev:
	uv run uvicorn riffspaced.api:app --reload --port 8000

lint:
	uv run ruff check . && uv run ruff format --check .

format:
	uv run ruff check --fix . && uv run ruff format .

test:
	uv run pytest -q

check: lint test

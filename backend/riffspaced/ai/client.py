"""The validated JSON client around the Anthropic SDK (SPEC 9, plan P7.T1).

One idea runs through this module: the model is asked for JSON of a known shape, and the
backend trusts nothing until it has parsed and validated it. A bad answer earns exactly one
retry that quotes the validation errors back; a second bad answer is an `AiError`, and the
endpoint turns that into an HTTP error rather than a half-right riff on the owner's screen.

Configuration (all environment variables, `.env` is loaded by `api.py`):

- `ANTHROPIC_API_KEY`: required for the live client. Missing means the AI endpoints answer
  503 with `{"reason": "ANTHROPIC_API_KEY not set"}`.
- `RIFFSPACED_MODEL`: model id, default `claude-sonnet-5-5` (DECISIONS 20).
- `RIFFSPACED_AI_FAKE=1`: use `fake_client.FakeAiClient` instead of the network. Tests and
  CI run this way; so does the frontend's e2e suite (DECISIONS 54).

Sampling parameters are deliberately absent. The plan asked for temperature 0.7 on suggest and
0.2 on analyze and cleanup, but current Claude models reject `temperature`, `top_p` and `top_k`
outright (DECISIONS 55); variety and consistency are steered in the prompts instead.
"""

from __future__ import annotations

import json
import logging
import os
import re
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from jsonschema import Draft202012Validator

log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 8000
MAX_ATTEMPTS = 2

# Opening and closing code fences, with or without a language tag. Models are asked for bare
# JSON, but a fenced answer is a formatting slip, not a reason to fail the call.
_FENCE = re.compile(r"^\s*```[a-zA-Z0-9_-]*\s*\n?|\n?\s*```\s*$")

REPAIR_PROMPT = (
    "Your previous response could not be used. Problems:\n{problems}\n\n"
    "Respond again with one JSON object only, matching the contract in the system prompt "
    "exactly: no prose before or after it, no code fences."
)

Message = dict[str, str]
Check = Callable[[Any], list[str]]


class AiError(RuntimeError):
    """The AI call failed for a reason the caller can show to the owner."""


class AiNotConfiguredError(AiError):
    """No API key and no fake client: the AI endpoints are off (SPEC 9: 503)."""

    reason = "ANTHROPIC_API_KEY not set"

    def __init__(self) -> None:
        super().__init__(self.reason)


@dataclass
class UsageRecord:
    """Token usage of one logical call, summed over its attempts, for the report."""

    purpose: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    attempts: int = 0

    def to_dict(self) -> dict[str, Any]:
        """CamelCase JSON shape for API responses."""
        return {
            "purpose": self.purpose,
            "model": self.model,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "attempts": self.attempts,
        }


@dataclass
class Completion:
    """What one round trip to the model returned."""

    text: str
    input_tokens: int = 0
    output_tokens: int = 0


def strip_code_fences(text: str) -> str:
    """Remove a leading ```json fence and a trailing ``` if the model added them."""
    return _FENCE.sub("", text.strip()).strip()


def parse_json_object(text: str) -> dict[str, Any]:
    """`json.loads` that insists on a top-level object and reports a short reason."""
    try:
        data = json.loads(strip_code_fences(text))
    except json.JSONDecodeError as error:
        raise ValueError(f"not valid JSON ({error.msg} at character {error.pos})") from error
    if not isinstance(data, dict):
        raise ValueError(f"expected a JSON object, got {type(data).__name__}")
    return data


def schema_problems(schema: dict[str, Any], data: Any) -> list[str]:
    """Every JSON Schema violation as `path: message`, sorted so retries read in order."""
    errors = sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: list(e.path))
    out: list[str] = []
    for error in errors:
        path = "/".join(str(p) for p in error.path) or "(root)"
        out.append(f"{path}: {error.message}")
    return out


class AiClient(ABC):
    """Ask for JSON, get validated JSON. Subclasses only have to talk to a model."""

    def __init__(self, model: str) -> None:
        self.model = model
        self.usage_log: list[UsageRecord] = []

    @abstractmethod
    def _complete(self, system: str, messages: list[Message], purpose: str) -> Completion:
        """One request: full conversation in, the model's text out."""

    def complete_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any],
        *,
        purpose: str,
        check: Check | None = None,
    ) -> dict[str, Any]:
        """Return the model's answer as a dict that passed `schema` and `check`.

        `check` runs after the schema and returns problems the schema cannot express (for
        example a riff that fails the semantic riff validator). Any problem on the first
        attempt is quoted back to the model once; a problem on the second attempt raises.
        """
        usage = UsageRecord(purpose=purpose, model=self.model)
        messages: list[Message] = [{"role": "user", "content": user}]
        problems: list[str] = []
        for attempt in range(1, MAX_ATTEMPTS + 1):
            completion = self._complete(system, messages, purpose)
            usage.attempts = attempt
            usage.input_tokens += completion.input_tokens
            usage.output_tokens += completion.output_tokens
            data: dict[str, Any] | None = None
            try:
                data = parse_json_object(completion.text)
            except ValueError as error:
                problems = [str(error)]
            else:
                problems = schema_problems(schema, data)
                if not problems and check is not None:
                    problems = check(data)
            if not problems and data is not None:
                self.usage_log.append(usage)
                log.info(
                    "ai %s: %s, %d in / %d out, %d attempt(s)",
                    purpose,
                    self.model,
                    usage.input_tokens,
                    usage.output_tokens,
                    attempt,
                )
                return data
            log.warning("ai %s attempt %d rejected: %s", purpose, attempt, "; ".join(problems))
            if attempt < MAX_ATTEMPTS:
                messages.append({"role": "assistant", "content": completion.text})
                listed = "\n".join(f"- {p}" for p in problems)
                messages.append({"role": "user", "content": REPAIR_PROMPT.format(problems=listed)})
        self.usage_log.append(usage)
        raise AiError(
            f"the model's {purpose} answer failed validation {MAX_ATTEMPTS} times: "
            + "; ".join(problems[:5])
        )

    @property
    def last_usage(self) -> UsageRecord | None:
        """The most recent call's token usage, or None before the first call."""
        return self.usage_log[-1] if self.usage_log else None


class AnthropicAiClient(AiClient):
    """The live client. Imports the SDK lazily so the fake path never needs it at runtime."""

    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        import anthropic

        super().__init__(model or model_name())
        # The SDK reads ANTHROPIC_API_KEY itself; an explicit key is for tests and tools.
        self._client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self._errors = anthropic

    def _complete(self, system: str, messages: list[Message], purpose: str) -> Completion:
        sdk = self._errors
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,  # type: ignore[arg-type]  (plain dicts are accepted)
            )
        except sdk.AuthenticationError as error:
            raise AiError("ANTHROPIC_API_KEY was rejected by the API") from error
        except sdk.RateLimitError as error:
            raise AiError("the API is rate limiting this key; try again shortly") from error
        except sdk.APIStatusError as error:
            raise AiError(f"the API returned {error.status_code}: {error.message}") from error
        except sdk.APIConnectionError as error:
            raise AiError("could not reach the Anthropic API") from error
        if response.stop_reason == "refusal":
            details = getattr(response, "stop_details", None)
            category = getattr(details, "category", None) or "unspecified"
            raise AiError(f"the model declined this {purpose} request (category: {category})")
        text = "".join(block.text for block in response.content if block.type == "text")
        if response.stop_reason == "max_tokens":
            log.warning("ai %s: answer hit max_tokens=%d, likely truncated", purpose, MAX_TOKENS)
        return Completion(
            text=text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


def model_name() -> str:
    """The configured model id (RIFFSPACED_MODEL), defaulting to DECISIONS 20."""
    return os.getenv("RIFFSPACED_MODEL") or DEFAULT_MODEL


def fake_requested() -> bool:
    """True when RIFFSPACED_AI_FAKE=1 (tests, CI, the e2e suite)."""
    return os.getenv("RIFFSPACED_AI_FAKE", "").strip() in {"1", "true", "yes"}


def ai_configured() -> bool:
    """What `/health` reports: a key is present or the fake is switched on."""
    return fake_requested() or bool(os.getenv("ANTHROPIC_API_KEY"))


def make_client(model: str | None = None) -> AiClient:
    """Pick the client the environment asks for, or raise `AiNotConfiguredError`."""
    if fake_requested():
        from riffspaced.ai.fake_client import FakeAiClient

        return FakeAiClient(model=model or model_name())
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise AiNotConfiguredError()
    return AnthropicAiClient(model=model)

/**
 * Calls to the backend's AI routes (SPEC 9.2). Kept free of store imports so the store's
 * AI slice can import this module without a cycle; callers pass the base URL and the model.
 *
 * Errors: the backend answers `503 { reason }` when no key is configured, `502 { reason }`
 * when the model's answer failed validation twice, and `4xx { detail }` for bad input. All
 * of them become a plain Error whose message is what the UI shows.
 */
import type { Riff } from '@/model/types';

export const AI_KINDS = [
  'variation',
  'counterRiff',
  'counterMelody',
  'switchUp',
  'simplify',
  'embellish',
  'newInStyle',
  'fingerings',
  'tunings',
] as const;
export type AiKind = (typeof AI_KINDS)[number];

export type AiDyad = {
  chordId: string;
  label: string;
  altLabels: string[];
  root: string;
  inverted: boolean;
  /** `model` when the model named it, `computed` when the backend filled it in. */
  source: 'model' | 'computed';
};

export type AiStyle = {
  keyCenterGuess: string;
  modeGuess: string;
  chromaticDevices: string[];
  turnaroundDetected: boolean;
  summary: string;
};

export type AiUsage = {
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
};

export type AiAnalyzeResult = {
  dyads: AiDyad[];
  style: AiStyle;
  warnings: string[];
  model: string;
  promptVersion: number;
  usage: AiUsage | null;
};

export type AiSuggestionResult = {
  riff: Riff;
  rationale: string;
  playingNotes: string;
  repairs: string[];
};

export type AiSuggestResult = {
  kind: AiKind;
  suggestions: AiSuggestionResult[];
  warnings: string[];
  model: string;
  promptVersion: number;
  usage: AiUsage | null;
};

export type AiCallOptions = {
  url: string;
  /** Sent as X-Riffspaced-Model; the backend honors it only when allowed (SPEC P7.T6). */
  model?: string;
  signal?: AbortSignal;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { reason?: unknown; detail?: unknown };
    if (typeof body.reason === 'string') return body.reason;
    if (typeof body.detail === 'string') return body.detail;
    return JSON.stringify(body.detail ?? body.reason ?? body);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

async function postJson<T>(path: string, body: unknown, options: AiCallOptions): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.model) headers['x-riffspaced-model'] = options.model;
  const response = await fetch(`${options.url}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export function aiAnalyze(riff: Riff, options: AiCallOptions): Promise<AiAnalyzeResult> {
  return postJson<AiAnalyzeResult>('/ai/analyze', riff, options);
}

export type AiSuggestRequest = {
  riff: Riff;
  kind: AiKind;
  count: number;
  intent?: string | null;
  /** Names and rationales already shown, so a second ask brings new ideas (DECISIONS 55). */
  avoid?: string[];
};

export function aiSuggest(
  request: AiSuggestRequest,
  options: AiCallOptions,
): Promise<AiSuggestResult> {
  return postJson<AiSuggestResult>('/ai/suggest', request, options);
}

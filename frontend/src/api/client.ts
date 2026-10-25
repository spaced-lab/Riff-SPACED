/**
 * Typed fetch wrapper for the backend (SPEC 8.4). Every call takes the base URL from the
 * store so AI > Settings can point the app at another server. Failures become plain Error
 * messages the UI can show; nothing here throws anything exotic.
 */
import type { Riff } from '@/model/types';
import { useStore } from '@/store';

export type Health = { status: string; version: string; aiConfigured: boolean };

export type TuningPreset = { name: string; pitches: number[]; stringCount: number };

export type AnalyzeOptions = {
  tuning?: string;
  bpm?: number | null;
  maxFret?: number;
  strings?: number[];
};

export type AnalyzeReport = {
  bpm: number;
  bpmCandidates: { bpm: number; score: number }[];
  bpmOverridden: boolean;
  noteCount: number;
  meanConfidence: number;
  lowConfidenceCount: number;
  downbeatOffsetSeconds: number;
  warnings: string[];
  timings: Record<string, number>;
};

export type AnalyzeResult = { riff: Riff; report: AnalyzeReport; reportMarkdown: string };

export const HEALTH_POLL_MS = 15_000;
export const HEALTH_TIMEOUT_MS = 4_000;

function baseUrl(): string {
  return useStore.getState().backend.url;
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export async function checkHealth(
  url: string = baseUrl(),
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<Health> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    if (!response.ok) throw new Error(await errorDetail(response));
    const health = (await response.json()) as Health;
    if (health.status !== 'ok') throw new Error(`backend reports status ${String(health.status)}`);
    return health;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTunings(url: string = baseUrl()): Promise<TuningPreset[]> {
  const response = await fetch(`${url}/tunings`);
  if (!response.ok) throw new Error(await errorDetail(response));
  return (await response.json()) as TuningPreset[];
}

export async function analyzeFile(
  file: File,
  options: AnalyzeOptions,
  url: string = baseUrl(),
): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('options', JSON.stringify(options));
  form.append('name', file.name.replace(/\.[^.]+$/, ''));
  const response = await fetch(`${url}/analyze`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(await errorDetail(response));
  return (await response.json()) as AnalyzeResult;
}

/** One health check, written into the store. */
export async function refreshHealth(): Promise<void> {
  const url = baseUrl();
  try {
    const health = await checkHealth(url);
    useStore.getState().setBackendStatus({
      status: 'ok',
      version: health.version,
      aiConfigured: Boolean(health.aiConfigured),
      checkedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    useStore.getState().setBackendStatus({
      status: 'unreachable',
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Poll /health every 15 s (and immediately on a URL change). Returns a stop function. */
export function startHealthPolling(intervalMs = HEALTH_POLL_MS): () => void {
  void refreshHealth();
  const timer = window.setInterval(() => void refreshHealth(), intervalMs);
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (state.backend.url !== previous.backend.url) void refreshHealth();
  });
  return () => {
    window.clearInterval(timer);
    unsubscribe();
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { analyzeFile, checkHealth, refreshHealth, startHealthPolling } from './client';

describe('backend client', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('marks the backend ok from /health and unreachable on failure', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/health'))
        return new Response(
          JSON.stringify({ status: 'ok', version: '0.6.0', aiConfigured: false }),
          { status: 200 },
        );
      return new Response('nope', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await refreshHealth();
    expect(useStore.getState().backend).toMatchObject({
      status: 'ok',
      version: '0.6.0',
      aiConfigured: false,
    });
    expect(await checkHealth('http://x')).toMatchObject({ version: '0.6.0' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await refreshHealth();
    expect(useStore.getState().backend.status).toBe('unreachable');
    expect(useStore.getState().backend.error).toBe('Failed to fetch');
  });

  it('posts the file and options and surfaces the detail on errors', async () => {
    let seen: { url: string; body: FormData } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        seen = { url, body: init?.body as FormData };
        return new Response(
          JSON.stringify({ riff: { id: 'r' }, report: { noteCount: 1 }, reportMarkdown: '# r' }),
          { status: 200 },
        );
      }),
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'take one.wav', { type: 'audio/wav' });
    const result = await analyzeFile(
      file,
      { tuning: 'Bb Standard', bpm: null, maxFret: 12, strings: [6, 5] },
      'http://b',
    );
    expect(result.reportMarkdown).toBe('# r');
    expect(seen!.url).toBe('http://b/analyze');
    expect(seen!.body.get('name')).toBe('take one');
    expect(JSON.parse(seen!.body.get('options') as string)).toMatchObject({
      tuning: 'Bb Standard',
      strings: [6, 5],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'unsupported type .txt' }), { status: 415 }),
      ),
    );
    await expect(analyzeFile(file, {}, 'http://b')).rejects.toThrow('unsupported type .txt');
  });

  it('polls every 15 s and again when the URL changes', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok', version: '1', aiConfigured: true }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const stop = startHealthPolling(15_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    useStore.getState().setBackendUrl('http://other:9000/');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const third = fetchMock.mock.calls[2] as unknown as [string];
    expect(third[0]).toBe('http://other:9000/health');
    expect(useStore.getState().backend.aiConfigured).toBe(true);
    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

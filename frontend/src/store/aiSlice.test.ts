import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Riff } from '@/model/types';
import { bootstrapStore, useStore } from '@/store';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function variationOf(riff: Riff, name: string): Riff {
  return { ...structuredClone(riff), id: `${riff.id}-v`, name, source: { type: 'ai' } };
}

describe('aiSlice', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().setBackendStatus({ status: 'ok', aiConfigured: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('analyze stores the result against the open riff and sends the model header', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://localhost:8000/ai/analyze');
      expect((init?.headers as Record<string, string>)['x-riffspaced-model']).toBe('claude-x');
      return jsonResponse({
        dyads: [
          {
            chordId: 'wd-c01',
            label: 'P5',
            altLabels: [],
            root: 'Db',
            inverted: false,
            source: 'model',
          },
        ],
        style: {
          keyCenterGuess: 'Db',
          modeGuess: 'minor',
          chromaticDevices: [],
          turnaroundDetected: true,
          summary: 'ok',
        },
        warnings: [],
        model: 'fake',
        promptVersion: 1,
        usage: null,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    useStore.getState().setAiModel('claude-x');
    await useStore.getState().analyzeCurrentRiff();
    const { ai } = useStore.getState();
    expect(ai.busy).toBeNull();
    expect(ai.analysis?.riffId).toBe('demo-riff-walkdown');
    expect(ai.analysis?.dyads[0]?.label).toBe('P5');
    expect(useStore.getState().toasts.at(-1)?.text).toContain('1 dyads labeled');
  });

  it('a 503 becomes an error toast with the backend reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ reason: 'ANTHROPIC_API_KEY not set' }, 503)),
    );
    await useStore.getState().analyzeCurrentRiff();
    expect(useStore.getState().ai.error).toBe('ANTHROPIC_API_KEY not set');
    expect(useStore.getState().toasts.at(-1)).toMatchObject({ kind: 'warn' });
  });

  it('suggest opens the drawer, appends cards, and passes earlier ones as avoid', async () => {
    const riff = useStore.getState().riff;
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          kind: 'variation',
          suggestions: [
            {
              riff: variationOf(riff, `var ${bodies.length}`),
              rationale: `r${bodies.length}`,
              playingNotes: '',
              repairs: [],
            },
          ],
          warnings: [],
          model: 'fake',
          promptVersion: 1,
          usage: null,
        });
      }),
    );
    await useStore.getState().suggestForCurrentRiff('variation', 1);
    await useStore.getState().suggestForCurrentRiff('variation', 1);
    const { ai } = useStore.getState();
    expect(ai.drawerOpen).toBe(true);
    expect(ai.suggestions.map((s) => s.riff.name)).toEqual(['var 1', 'var 2']);
    expect((bodies[1] as { avoid: string[] }).avoid).toEqual(['var 1: r1']);
  });

  it('accept as variation is one undo step; accept as new riff lands in the library', () => {
    const riff = useStore.getState().riff;
    useStore.setState((s) => ({
      ai: {
        ...s.ai,
        drawerOpen: true,
        suggestions: [
          {
            id: 'a',
            kind: 'variation',
            parentRiffId: riff.id,
            model: 'fake',
            riff: variationOf(riff, 'A'),
            rationale: '',
            playingNotes: '',
            repairs: [],
          },
          {
            id: 'b',
            kind: 'newInStyle',
            parentRiffId: riff.id,
            model: 'fake',
            riff: variationOf(riff, 'B'),
            rationale: '',
            playingNotes: '',
            repairs: [],
          },
        ],
      },
    }));
    useStore.getState().acceptAsVariation('a');
    let s = useStore.getState();
    expect(s.riff.lengthBars).toBe(8);
    expect(s.riff.sections.map((x) => x.kind)).toEqual(['main', 'variation']);
    expect(s.history.past.map((h) => h.label)).toEqual(['add variation from AI']);
    expect(s.ai.suggestions.map((x) => x.id)).toEqual(['b']);
    s.undo();
    expect(useStore.getState().riff.lengthBars).toBe(4);

    const before = useStore.getState().library.riffs.length;
    useStore.getState().acceptAsNewRiff('b');
    s = useStore.getState();
    expect(s.library.riffs).toHaveLength(before + 1);
    expect(s.library.riffs.at(-1)).toMatchObject({ name: 'B' });
    expect(s.library.riffs.at(-1)!.tags).toContain('ai');
    expect(s.currentRiffId).toBe(riff.id);
    expect(s.ai.suggestions).toEqual([]);
  });

  it('audition sets the transient riff and starts the transport; stop clears both', () => {
    const riff = useStore.getState().riff;
    useStore.setState((s) => ({
      ai: {
        ...s.ai,
        suggestions: [
          {
            id: 'a',
            kind: 'variation',
            parentRiffId: riff.id,
            model: 'fake',
            riff: variationOf(riff, 'A'),
            rationale: '',
            playingNotes: '',
            repairs: [],
          },
        ],
      },
    }));
    useStore.getState().auditionSuggestion('a');
    expect(useStore.getState().auditionId).toBe('a');
    expect(useStore.getState().auditionRiff?.name).toBe('A');
    expect(useStore.getState().isPlaying).toBe(true);
    useStore.getState().auditionSuggestion('a');
    expect(useStore.getState().auditionId).toBeNull();
    expect(useStore.getState().auditionRiff).toBeNull();
    expect(useStore.getState().isPlaying).toBe(false);
    // The riff itself never changed.
    expect(useStore.getState().riff).toBe(riff);
  });
});

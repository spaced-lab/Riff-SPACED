import type { StateCreator } from 'zustand';
import { aiAnalyze, aiSuggest } from '@/api/ai';
import type { AiAnalyzeResult, AiKind, AiSuggestionResult } from '@/api/ai';
import { uuid } from '@/model/ids';
import type { Riff } from '@/model/types';
import { appendAsVariation, asSiblingRiff } from './aiOps';
import type { AppState } from './types';

/** The last analysis, remembered with the riff it was made for. */
export type AiAnalysis = Omit<AiAnalyzeResult, 'usage'> & { riffId: string };

/** One card in the drawer. `id` is local; the riff inside has its own id. */
export type AiSuggestion = AiSuggestionResult & {
  id: string;
  kind: AiKind;
  parentRiffId: string;
  model: string;
};

export const KIND_LABELS: Record<AiKind, string> = {
  variation: 'variation',
  counterRiff: 'counter riff',
  counterMelody: 'counter melody',
  switchUp: 'switch-up',
  simplify: 'simplified',
  embellish: 'embellished',
  newInStyle: 'new riff in style',
  fingerings: 'fingering',
  tunings: 'tuning',
};

/**
 * The AI layer in the store (SPEC 9.3, P7.T6). Analysis and suggestions are plain state
 * the panels render; the only thing that touches the owner's riff is an explicit accept,
 * and each accept is one `commit`, so one undo step. Audition plays a suggestion through
 * the engine by setting `auditionRiff`, which the engine prefers over the open riff while
 * it is set; the open riff is never modified by listening.
 */
export type AiSlice = {
  ai: {
    /** What is running, for the menu's disabled reason, or null. */
    busy: string | null;
    error: string | null;
    analysis: AiAnalysis | null;
    suggestions: AiSuggestion[];
    drawerOpen: boolean;
    /** Model override sent as a header; empty means the server's default. */
    model: string;
  };
  auditionRiff: Riff | null;
  auditionId: string | null;
  analyzeCurrentRiff: () => Promise<void>;
  suggestForCurrentRiff: (kind: AiKind, count: number, intent?: string) => Promise<void>;
  setAiModel: (model: string) => void;
  setAiDrawerOpen: (open: boolean) => void;
  clearSuggestions: () => void;
  discardSuggestion: (id: string) => void;
  /** Start listening to a suggestion, or stop when it is the one playing. */
  auditionSuggestion: (id: string) => void;
  stopAudition: () => void;
  /** Append the suggestion as a variation section of the open riff: one undo step. */
  acceptAsVariation: (id: string) => void;
  /** Add the suggestion to the library as a sibling riff tagged `ai`; the open riff stays. */
  acceptAsNewRiff: (id: string) => void;
};

export const createAiSlice: StateCreator<AppState, [], [], AiSlice> = (set, get) => {
  const patch = (p: Partial<AiSlice['ai']>) => set((s) => ({ ai: { ...s.ai, ...p } }));
  const options = () => {
    const s = get();
    return { url: s.backend.url, model: s.ai.model || undefined };
  };
  const find = (id: string) => get().ai.suggestions.find((x) => x.id === id);

  return {
    ai: { busy: null, error: null, analysis: null, suggestions: [], drawerOpen: false, model: '' },
    auditionRiff: null,
    auditionId: null,

    analyzeCurrentRiff: async () => {
      const s = get();
      if (s.ai.busy || s.editing !== 'riff') return;
      patch({ busy: 'analyzing', error: null });
      try {
        const result = await aiAnalyze(s.riff, options());
        const { dyads, style, warnings, model, promptVersion } = result;
        patch({
          busy: null,
          analysis: { dyads, style, warnings, model, promptVersion, riffId: s.riff.id },
        });
        const computed = result.dyads.filter((d) => d.source === 'computed').length;
        get().toast(
          `analysis: ${result.dyads.length} dyads labeled${computed ? ` (${computed} computed)` : ''}, ${result.model}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patch({ busy: null, error: message });
        get().toast(`AI analyze failed: ${message}`, 'warn');
      }
    },

    suggestForCurrentRiff: async (kind, count, intent) => {
      const s = get();
      if (s.ai.busy || s.editing !== 'riff') return;
      const avoid = s.ai.suggestions
        .filter((x) => x.kind === kind && x.parentRiffId === s.riff.id)
        .map((x) => `${x.riff.name}: ${x.rationale}`);
      patch({ busy: `asking for ${KIND_LABELS[kind]}s`, error: null, drawerOpen: true });
      try {
        const result = await aiSuggest(
          { riff: s.riff, kind, count, intent: intent ?? null, avoid },
          options(),
        );
        const cards: AiSuggestion[] = result.suggestions.map((x) => ({
          ...x,
          id: uuid(),
          kind,
          parentRiffId: s.riff.id,
          model: result.model,
        }));
        set((state) => ({
          ai: {
            ...state.ai,
            busy: null,
            suggestions: [...state.ai.suggestions, ...cards],
            drawerOpen: true,
          },
        }));
        for (const warning of result.warnings) get().toast(warning, 'warn');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patch({ busy: null, error: message });
        get().toast(`AI suggest failed: ${message}`, 'warn');
      }
    },

    setAiModel: (model) => patch({ model: model.trim() }),
    setAiDrawerOpen: (open) => {
      if (!open) get().stopAudition();
      patch({ drawerOpen: open });
    },
    clearSuggestions: () => {
      get().stopAudition();
      patch({ suggestions: [] });
    },
    discardSuggestion: (id) => {
      if (get().auditionId === id) get().stopAudition();
      patch({ suggestions: get().ai.suggestions.filter((x) => x.id !== id) });
    },

    auditionSuggestion: (id) => {
      const s = get();
      if (s.auditionId === id) {
        s.stopAudition();
        return;
      }
      const card = find(id);
      if (!card) return;
      set({ auditionRiff: card.riff, auditionId: id });
      if (!get().isPlaying) get().play();
    },
    stopAudition: () => {
      if (get().auditionId === null) return;
      if (get().isPlaying) get().stop();
      set({ auditionRiff: null, auditionId: null });
    },

    acceptAsVariation: (id) => {
      const card = find(id);
      if (!card) return;
      try {
        const next = appendAsVariation(get().riff, card.riff);
        get().commit(`add ${KIND_LABELS[card.kind]} from AI`, () => next);
        get().discardSuggestion(id);
        get().toast(`added "${card.riff.name}" as section ${next.sections.at(-1)!.label}`);
      } catch (error) {
        get().toast(error instanceof Error ? error.message : String(error), 'warn');
      }
    },

    acceptAsNewRiff: (id) => {
      const card = find(id);
      if (!card) return;
      const s = get();
      s.syncCurrentRiff();
      const copy = asSiblingRiff(
        card.riff,
        get().library.riffs.map((r) => r.name),
      );
      set((state) => ({ library: { ...state.library, riffs: [...state.library.riffs, copy] } }));
      get().discardSuggestion(id);
      get().toast(`added "${copy.name}" to the library`);
    },
  };
};

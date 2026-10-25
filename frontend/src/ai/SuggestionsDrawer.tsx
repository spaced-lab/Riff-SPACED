import { useEffect } from 'react';
import { useStore } from '@/store';
import { SuggestionCard } from './SuggestionCard';
import './ai.css';

/**
 * The right-side suggestions drawer (SPEC 9.3). Opens when a suggestion request starts and
 * stays until closed. Closing or discarding stops any audition; a stop from the transport
 * (Space, the stop button) ends the audition too, so the fretboard returns to the riff.
 */
export function SuggestionsDrawer() {
  const open = useStore((s) => s.ai.drawerOpen);
  const busy = useStore((s) => s.ai.busy);
  const error = useStore((s) => s.ai.error);
  const suggestions = useStore((s) => s.ai.suggestions);
  const isPlaying = useStore((s) => s.isPlaying);
  const auditionId = useStore((s) => s.auditionId);
  const stopAudition = useStore((s) => s.stopAudition);
  const setOpen = useStore((s) => s.setAiDrawerOpen);
  const clear = useStore((s) => s.clearSuggestions);

  useEffect(() => {
    if (!isPlaying && auditionId !== null) stopAudition();
  }, [isPlaying, auditionId, stopAudition]);

  if (!open) return null;
  return (
    <aside className="ai-drawer" data-testid="suggestions-drawer" aria-label="AI suggestions">
      <div className="ai-drawer__head">
        <h2>suggestions</h2>
        {busy ? <span className="ai-card__kind">{busy}...</span> : null}
        <button type="button" onClick={clear} disabled={suggestions.length === 0}>
          clear
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="close suggestions">
          ×
        </button>
      </div>
      <div className="ai-drawer__body">
        {error ? <div className="ai-analysis__warn">{error}</div> : null}
        {suggestions.length === 0 && !busy ? (
          <p className="ai-drawer__empty">
            nothing yet. ask through the AI menu: variations, a counter riff, a simpler take,
            embellishments, other fingerings or tunings.
          </p>
        ) : null}
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
      </div>
    </aside>
  );
}

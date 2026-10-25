import { Fretboard } from '@/fretboard/Fretboard';
import { useStore } from '@/store';
import type { AiSuggestion } from '@/store/aiSlice';
import { KIND_LABELS } from '@/store/aiSlice';

// The mini fretboard is drawn at a fixed size so the card never grows past the drawer.
const PREVIEW_WIDTH = 340;
const PREVIEW_HEIGHT = 110;

/**
 * One suggestion (SPEC 9.3): name, rationale, playing notes, a mini fretboard with every
 * position the suggestion uses, and the four verbs. Nothing here changes the owner's riff
 * until "add as variation" or "add as new riff" is clicked.
 */
export function SuggestionCard({ suggestion }: { suggestion: AiSuggestion }) {
  const auditionId = useStore((s) => s.auditionId);
  const accidentals = useStore((s) => s.accidentals);
  const currentTuning = useStore((s) => s.riff.tuning);
  const audition = useStore((s) => s.auditionSuggestion);
  const acceptAsVariation = useStore((s) => s.acceptAsVariation);
  const acceptAsNewRiff = useStore((s) => s.acceptAsNewRiff);
  const discard = useStore((s) => s.discardSuggestion);
  const auditioning = auditionId === suggestion.id;
  const riff = suggestion.riff;
  const sameTuning = riff.tuning.pitches.join() === currentTuning.pitches.join();

  return (
    <article
      className={auditioning ? 'ai-card ai-card--auditioning' : 'ai-card'}
      data-testid="suggestion-card"
      data-kind={suggestion.kind}
    >
      <div className="ai-card__title">
        <strong>{riff.name}</strong>
        <span className="ai-card__kind">
          {KIND_LABELS[suggestion.kind]} · {riff.lengthBars} bars · {riff.notes.length} notes
          {sameTuning ? '' : ` · ${riff.tuning.name}`}
        </span>
      </div>
      <p className="ai-card__rationale">{suggestion.rationale}</p>
      {suggestion.playingNotes ? (
        <div className="ai-card__notes">{suggestion.playingNotes}</div>
      ) : null}
      <div className="ai-card__preview">
        <Fretboard
          tuning={riff.tuning}
          notes={riff.notes}
          range={{ from: 0, to: 12 }}
          showLetters={false}
          accidentals={accidentals}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          label={`preview of ${riff.name}`}
        />
      </div>
      {suggestion.repairs.length ? (
        <div className="ai-card__repairs">
          backend repairs:
          <ul>
            {suggestion.repairs.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="ai-card__buttons">
        <button type="button" onClick={() => audition(suggestion.id)}>
          {auditioning ? 'stop' : 'audition'}
        </button>
        <button
          type="button"
          disabled={!sameTuning}
          title={sameTuning ? undefined : 'different tuning: add it as a new riff instead'}
          onClick={() => acceptAsVariation(suggestion.id)}
        >
          add as variation
        </button>
        <button type="button" onClick={() => acceptAsNewRiff(suggestion.id)}>
          add as new riff
        </button>
        <button type="button" onClick={() => discard(suggestion.id)}>
          discard
        </button>
      </div>
    </article>
  );
}

import { useStore } from '@/store';
import './ai.css';

/**
 * The AI analysis of the open riff (SPEC 9.2): one chip per dyad (click selects the chord's
 * notes), the style reading, the chromatic devices, the turnaround flag and any warnings.
 * Chips the backend computed because the model skipped them are drawn dashed.
 */
export function AnalysisPanel() {
  const analysis = useStore((s) => s.ai.analysis);
  const riff = useStore((s) => s.riff);
  const select = useStore((s) => s.select);
  const setEditCursorTick = useStore((s) => s.setEditCursorTick);
  if (!analysis || analysis.riffId !== riff.id) return null;

  const selectChord = (chordId: string) => {
    const members = riff.notes.filter((n) => n.chordId === chordId);
    if (!members.length) return;
    select(members.map((n) => n.id));
    setEditCursorTick(members[0]!.start);
  };

  const { style } = analysis;
  return (
    <div data-testid="analysis-panel">
      <h3>AI analysis</h3>
      <div className="ai-analysis__dyads" data-testid="analysis-dyads">
        {analysis.dyads.map((d) => (
          <button
            key={d.chordId}
            type="button"
            className={[
              'ai-analysis__dyad',
              d.inverted ? 'ai-analysis__dyad--inverted' : '',
              d.source === 'computed' ? 'ai-analysis__dyad--computed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={`${d.chordId}: root ${d.root}${d.inverted ? ', inverted' : ''}${
              d.altLabels.length ? `, also ${d.altLabels.join(', ')}` : ''
            }${d.source === 'computed' ? ' (computed by the backend)' : ''}`}
            data-chord-id={d.chordId}
            onClick={() => selectChord(d.chordId)}
          >
            {d.label}
            {d.inverted ? ' (inv)' : ''}
          </button>
        ))}
      </div>
      <p className="ai-analysis__summary" data-testid="analysis-summary">
        {style.summary}
      </p>
      <div className="ai-analysis__meta">
        key {style.keyCenterGuess} · {style.modeGuess} · turnaround{' '}
        {style.turnaroundDetected ? 'yes' : 'no'}
      </div>
      {style.chromaticDevices.length ? (
        <ul className="ai-analysis__devices">
          {style.chromaticDevices.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {analysis.warnings.map((w) => (
        <div key={w} className="ai-analysis__warn">
          {w}
        </div>
      ))}
      <div className="ai-analysis__meta">
        {analysis.model}, prompt v{analysis.promptVersion}
      </div>
    </div>
  );
}

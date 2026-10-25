import { AnalysisPanel } from '@/ai/AnalysisPanel';
import { NotePanel } from './NotePanel';
import { RiffPanel } from './RiffPanel';
import { SectionsPanel } from './SectionsPanel';
import './inspector.css';

/** Right-hand panel: the riff, the AI analysis when there is one, the selection, the sections. */
export function Inspector() {
  return (
    <div className="inspector" data-testid="inspector">
      <RiffPanel />
      <AnalysisPanel />
      <NotePanel />
      <SectionsPanel />
    </div>
  );
}

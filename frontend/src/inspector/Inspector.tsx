import { NotePanel } from './NotePanel';
import { RiffPanel } from './RiffPanel';
import { SectionsPanel } from './SectionsPanel';
import './inspector.css';

/** Right-hand panel: the selection (notes and dyads) and the section list. */
export function Inspector() {
  return (
    <div className="inspector" data-testid="inspector">
      <RiffPanel />
      <NotePanel />
      <SectionsPanel />
    </div>
  );
}

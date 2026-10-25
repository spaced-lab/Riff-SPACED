import { NotePanel } from './NotePanel';
import { SectionsPanel } from './SectionsPanel';
import './inspector.css';

/** Right-hand panel: the selection (notes and dyads) and the section list. */
export function Inspector() {
  return (
    <div className="inspector" data-testid="inspector">
      <NotePanel />
      <SectionsPanel />
    </div>
  );
}

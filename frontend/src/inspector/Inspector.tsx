import { SectionsPanel } from './SectionsPanel';
import './inspector.css';

/** Right-hand panel. Sections now; notes and dyads in P3.T6. */
export function Inspector() {
  return (
    <div className="inspector" data-testid="inspector">
      <SectionsPanel />
    </div>
  );
}

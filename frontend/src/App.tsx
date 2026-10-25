import { Shell } from './app/Shell';
import { FretboardHarness } from './dev/FretboardHarness';
import { useHashRoute } from './hooks/useHashRoute';

/** Application root: picks a page from the hash route. */
export function App() {
  const route = useHashRoute();
  if (route === '/dev/fretboard') return <FretboardHarness />;
  return <Shell />;
}

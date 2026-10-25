/**
 * Typed view of shared/fixtures/music-conventions.json. Test-only.
 * `caseCount` lets a parity test prove every case in the file was consumed.
 */
import conventions from '@shared/fixtures/music-conventions.json';

export type Conventions = typeof conventions;
export const fixture: Conventions = conventions;

/** Total number of input/expected cases in the fixture, counted structurally. */
export function caseCount(fx: Conventions = fixture): number {
  const t = fx.tunings;
  return (
    fx.pitchNames.length +
    fx.frequencies.length +
    t.standard.length +
    t.drop.length +
    t.sevenString.length +
    t.validity.length +
    fx.pitchOf.length +
    Object.keys(fx.ticks.grid).length +
    fx.ticks.ticksToSeconds.length +
    fx.ticks.barBeatTick.length +
    fx.ticks.snapToGrid.length +
    fx.dyads.length +
    fx.fingerings.find.length +
    fx.fingerings.best.length +
    fx.fingerings.handSpan.length
  );
}

/** `pitchOf` for a bare pitch array, so the engine does not need a Tuning object. */
export function pitchOfArray(pitches: readonly number[], string: number, fret: number): number {
  const open = pitches[pitches.length - string];
  if (open === undefined) throw new RangeError(`string ${string} is not in 1..${pitches.length}`);
  return open + fret;
}

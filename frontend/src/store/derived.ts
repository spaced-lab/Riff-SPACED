/**
 * Derived views over the store (P5.T3). What the center of the app shows and plays depends
 * on the editing mode: the open riff, or a flattened arrangement or song, which is read-only.
 * Memoized on the inputs so selectors stay referentially stable between unrelated updates.
 */
import { flattenArrangement, flattenSong } from '@/arrangement/flatten';
import type { FlatRiff } from '@/arrangement/flatten';
import type { Riff } from '@/model/types';
import type { AppState } from './types';

export type DisplayRiff = {
  riff: Riff | FlatRiff;
  readOnly: boolean;
  markers: FlatRiff['markers'];
};

type Inputs = Pick<
  AppState,
  'editing' | 'riff' | 'library' | 'currentArrangementId' | 'currentSongId' | 'currentRiffId'
>;

let cacheKey: [Inputs['editing'], Riff, Inputs['library'], string | null, string | null] | null =
  null;
let cacheValue: DisplayRiff | null = null;

export function selectDisplayRiff(s: Inputs): DisplayRiff {
  const key: typeof cacheKey = [
    s.editing,
    s.riff,
    s.library,
    s.currentArrangementId,
    s.currentSongId,
  ];
  if (cacheKey && cacheValue && key.every((v, i) => v === cacheKey![i])) return cacheValue;
  let value: DisplayRiff;
  if (s.editing === 'arrangement') {
    const arrangement = s.library.arrangements.find((a) => a.id === s.currentArrangementId);
    value = arrangement
      ? (() => {
          const flat = flattenArrangement(arrangement, libraryWithCurrentRiff(s));
          return { riff: flat, readOnly: true, markers: flat.markers };
        })()
      : { riff: s.riff, readOnly: false, markers: [] };
  } else if (s.editing === 'song') {
    const song = s.library.songs.find((x) => x.id === s.currentSongId);
    value = song
      ? (() => {
          const flat = flattenSong(song, libraryWithCurrentRiff(s));
          return { riff: flat, readOnly: true, markers: flat.markers };
        })()
      : { riff: s.riff, readOnly: false, markers: [] };
  } else {
    value = { riff: s.riff, readOnly: false, markers: [] };
  }
  cacheKey = key;
  cacheValue = value;
  return value;
}

/** The library with the open riff's unsaved edits folded in, so flattening sees them. */
function libraryWithCurrentRiff(s: Inputs): Inputs['library'] {
  const id = s.currentRiffId;
  if (!id) return s.library;
  return { ...s.library, riffs: s.library.riffs.map((r) => (r.id === id ? s.riff : r)) };
}

/** File > Recent: the last ten opened or saved names, newest first, in localStorage. */
export const RECENT_KEY = 'riffspaced.recent.v1';
export const RECENT_MAX = 10;

export type RecentEntry = {
  name: string;
  kind: 'riff' | 'arrangement' | 'song' | 'library';
  id: string;
  at: string;
};

type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

export function readRecent(storage: KV | null = safeStorage()): RecentEntry[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(
  entry: Omit<RecentEntry, 'at'>,
  storage: KV | null = safeStorage(),
): RecentEntry[] {
  const next = [
    { ...entry, at: new Date().toISOString() },
    ...readRecent(storage).filter((e) => e.id !== entry.id),
  ].slice(0, RECENT_MAX);
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: recents are a convenience, nothing else depends on them.
  }
  return next;
}

function safeStorage(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

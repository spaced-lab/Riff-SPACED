import { useEffect, useState } from 'react';

/**
 * A hand-rolled hash router (no dependency): `/#/dev/fretboard` yields `/dev/fretboard`,
 * an empty or missing hash yields `/`. Hash routing keeps GitHub Pages happy because the
 * server never sees the path.
 */
export function readHashPath(hash: string = window.location.hash): string {
  const path = hash.replace(/^#/, '');
  return path.startsWith('/') ? path : '/';
}

export function useHashRoute(): string {
  const [path, setPath] = useState(() => readHashPath());
  useEffect(() => {
    const onChange = () => setPath(readHashPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

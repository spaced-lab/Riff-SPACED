import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type Size = { width: number; height: number };

/**
 * Tracks an element's content box with ResizeObserver so an SVG can size its viewBox to
 * its container. Falls back to `fallback` where ResizeObserver does not exist (jsdom).
 */
export function useElementSize<T extends HTMLElement>(
  fallback: Size = { width: 900, height: 220 },
): [RefObject<T>, Size] {
  // React 18 typing: a ref object created with a null initial value is a RefObject<T>.
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize((prev) =>
          prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height },
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

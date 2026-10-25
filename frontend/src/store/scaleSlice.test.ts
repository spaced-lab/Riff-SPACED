import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { selectScaleRoot } from './scaleSlice';

describe('scaleSlice', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('starts off, on the minor pentatonic, every color on, root following the tuning', () => {
    const s = useStore.getState();
    expect(s.scaleMode).toBe('off');
    expect(s.scaleId).toBe('minorPentatonic');
    expect(s.scaleRoot).toBeNull();
    expect(Object.values(s.scaleColors).every(Boolean)).toBe(true);
    // The demo library is in Bb Standard: the low string is Bb, pitch class 10.
    expect(selectScaleRoot(s)).toBe(10);
  });

  it('follows the tuning until a root is chosen, then keeps it', () => {
    useStore.getState().setTuning({ name: 'E Standard', pitches: [40, 45, 50, 55, 59, 64] });
    expect(selectScaleRoot(useStore.getState())).toBe(4);
    useStore.getState().setScaleRoot(15); // wraps to 3 (Eb)
    expect(useStore.getState().scaleRoot).toBe(3);
    expect(selectScaleRoot(useStore.getState())).toBe(3);
    useStore.getState().setScaleRoot(null);
    expect(selectScaleRoot(useStore.getState())).toBe(4);
  });

  it('toggles one color group without touching the others', () => {
    useStore.getState().toggleScaleColor('roots');
    expect(useStore.getState().scaleColors.roots).toBe(false);
    expect(useStore.getState().scaleColors.fifths).toBe(true);
    useStore.getState().setScaleColor('roots', true);
    expect(useStore.getState().scaleColors.roots).toBe(true);
    useStore.getState().setScaleMode('mono');
    useStore.getState().setScaleId('blues');
    expect(useStore.getState().scaleMode).toBe('mono');
    expect(useStore.getState().scaleId).toBe('blues');
  });
});

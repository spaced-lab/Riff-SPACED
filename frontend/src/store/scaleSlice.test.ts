import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import {
  selectScaleOverlay,
  selectScalePosition,
  selectScalePositions,
  selectScaleRoot,
} from './scaleSlice';

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

  it('steps through the CAGED positions and back to the whole neck (P9.T5)', () => {
    const s = useStore.getState();
    // Bb minor pentatonic in Bb Standard: standard intervals, so the shapes have letters.
    const positions = selectScalePositions(s);
    expect(positions.length).toBeGreaterThan(5);
    expect(positions.map((p) => p.name).slice(0, 5)).toEqual([
      'E shape',
      'D shape',
      'C shape',
      'A shape',
      'G shape',
    ]);
    expect(positions[0]!.fromFret).toBe(0);
    expect(selectScalePosition(s)).toBeNull();
    s.stepScalePosition(1);
    expect(useStore.getState().scalePosition).toBe(0);
    s.stepScalePosition(-1);
    expect(useStore.getState().scalePosition).toBeNull();
    s.stepScalePosition(-1);
    expect(useStore.getState().scalePosition).toBe(positions.length - 1);
    s.stepScalePosition(1);
    expect(useStore.getState().scalePosition).toBeNull();
    s.setScalePosition(99);
    expect(useStore.getState().scalePosition).toBe(positions.length - 1);
    // The overlay carries the clamped position; a scale with fewer positions clamps again.
    s.setScaleMode('color');
    expect(selectScaleOverlay(useStore.getState())?.position?.index).toBe(positions.length - 1);
    s.setScalePosition(2);
    expect(selectScaleOverlay(useStore.getState())?.position?.name).toBe('C shape');
  });
});

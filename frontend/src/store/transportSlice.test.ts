import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from './index';
import { clampBpm } from './transportSlice';

describe('transport slice', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('toggles play, loop, count-in, metronome, voice', () => {
    const s = useStore.getState();
    s.togglePlay();
    expect(useStore.getState().isPlaying).toBe(true);
    s.stop();
    expect(useStore.getState().isPlaying).toBe(false);
    s.play();
    s.togglePlay();
    expect(useStore.getState().isPlaying).toBe(false);
    s.setLoopEnabled(false);
    s.setCountIn(true);
    s.setMetronome(true);
    s.setVoice('heavy');
    const v = useStore.getState();
    expect([v.loopEnabled, v.countIn, v.metronome, v.voice]).toEqual([false, true, true, 'heavy']);
  });

  it('bpm edits the riff tempo through commit with clamping', () => {
    const s = useStore.getState();
    s.setBpm(140);
    expect(useStore.getState().riff.tempo.bpm).toBe(140);
    expect(useStore.getState().history.past.at(-1)?.label).toBe('tempo');
    s.nudgeBpm(-5);
    expect(useStore.getState().riff.tempo.bpm).toBe(135);
    s.setBpm(1000);
    expect(useStore.getState().riff.tempo.bpm).toBe(300);
    s.setBpm(300);
    expect(useStore.getState().history.past.filter((h) => h.label === 'tempo')).toHaveLength(3);
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(92.6)).toBe(93);
  });

  it('solo toggles per section and engine setters skip unchanged values', () => {
    const s = useStore.getState();
    const id = s.riff.sections[0]!.id;
    s.toggleSoloSection(id);
    expect(useStore.getState().soloSectionId).toBe(id);
    s.toggleSoloSection(id);
    expect(useStore.getState().soloSectionId).toBeNull();
    s.setPositionTick(480);
    let writes = 0;
    const unsub = useStore.subscribe((a, b) => {
      if (a.positionTick !== b.positionTick) writes++;
    });
    s.setPositionTick(480);
    s.setPositionTick(481);
    unsub();
    expect(writes).toBe(1);
    s.setAudioState('running');
    expect(useStore.getState().audioState).toBe('running');
  });
});

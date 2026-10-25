import { describe, expect, it } from 'vitest';
import { playhead } from './playheadRef';

describe('playhead follow', () => {
  it('scrolls the container only when the playhead leaves the middle 60 percent', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
    scroller.scrollLeft = 0;
    playhead.register(line, 320);
    playhead.setScroller(scroller);
    playhead.setFollow(true);
    playhead.setTick(1920); // x = 320, inside [200, 800]
    expect(scroller.scrollLeft).toBe(0);
    playhead.setTick(1920 * 3); // x = 960, past 800: recenter on 460
    expect(scroller.scrollLeft).toBe(460);
    playhead.setFollow(false);
    playhead.setTick(1920 * 10);
    expect(scroller.scrollLeft).toBe(460);
    expect(line.getAttribute('x1')).toBe(String(((1920 * 10) / 1920) * 320));
    playhead.setScroller(null);
    playhead.register(null, 320);
  });
});

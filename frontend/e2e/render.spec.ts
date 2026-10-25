import { expect, test } from '@playwright/test';
import type * as RenderModule from '../src/audio/render';
import { watchConsole } from './helpers';

/**
 * Nobody can listen in CI, so this test renders the demo riff offline through the real
 * engine and checks the signal is not silent and starts on time (SPEC 6.3).
 */
test('offline render of the demo riff is audible and starts at tick 0', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // Vite serves source modules at their project path in dev; the cast gives us the types.
    const modulePath = '/src/audio/render.ts';
    const mod = (await import(/* @vite-ignore */ modulePath)) as typeof RenderModule;
    const riff = window.riffspaced!.store.getState().library.riffs[0]!;
    const { buffer, wav } = await mod.renderRiff(riff, { passes: 1, sampleRate: 22050 });
    const data = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < 22050; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
    return {
      seconds: buffer.duration,
      rms: mod.rms(data),
      onset: mod.firstOnset(data, buffer.sampleRate),
      wavBytes: wav.byteLength,
      peak,
    };
  });
  // 4 bars at 92 BPM is about 10.4 s plus the tail.
  expect(result.seconds).toBeGreaterThan(10);
  expect(result.rms).toBeGreaterThan(0.01);
  expect(result.peak).toBeGreaterThan(0.05);
  expect(result.onset).not.toBeNull();
  // The scheduler starts 50 ms after time zero; the first attack must land within 20 ms of that.
  expect(Math.abs((result.onset ?? 0) - 0.05)).toBeLessThan(0.02);
  expect(result.wavBytes).toBe(44 + Math.ceil(result.seconds * 22050) * 2);
  expect(console.errors).toEqual([]);
});

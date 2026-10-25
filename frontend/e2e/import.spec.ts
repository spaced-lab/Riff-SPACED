import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/** The import flow against a mocked backend: health, then /analyze returning a riff with low-confidence notes. */
const cannedRiff = {
  format: 'riff-spaced/riff',
  version: 1,
  id: 'imported-take',
  name: 'take',
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
  tuning: { name: 'Bb Standard', pitches: [34, 39, 44, 49, 53, 58] },
  tempo: { bpm: 92 },
  timeSignature: { beats: 4, unit: 4 },
  ppq: 480,
  lengthBars: 4,
  sections: [{ id: 'main', label: 'A', startBar: 0, lengthBars: 4, kind: 'main' }],
  notes: [
    {
      id: 'n0-0',
      string: 6,
      fret: 3,
      start: 0,
      duration: 240,
      velocity: 100,
      confidence: 0.95,
      techniques: ['palmMute'],
      chordId: 'c0',
    },
    {
      id: 'n0-1',
      string: 5,
      fret: 5,
      start: 0,
      duration: 240,
      velocity: 100,
      confidence: 0.95,
      techniques: ['palmMute'],
      chordId: 'c0',
    },
    { id: 'n1-0', string: 6, fret: 5, start: 480, duration: 240, velocity: 90, confidence: 0.41 },
    { id: 'n2-0', string: 6, fret: 1, start: 960, duration: 240, velocity: 90, confidence: 0.3 },
  ],
  tags: ['imported'],
  source: { type: 'audio', audioFile: 'take.wav', analysisVersion: '0.6.0', bpmDetected: 92.1 },
};

test('import from audio lands a riff in the library with amber low-confidence notes', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', version: '0.6.0', aiConfigured: false } }),
  );
  await page.route('**/analyze', async (route) => {
    const headers = route.request().headers();
    expect(headers['content-type']).toContain('multipart/form-data');
    await route.fulfill({
      json: {
        riff: cannedRiff,
        report: {
          bpm: 92.1,
          bpmCandidates: [{ bpm: 92.1, score: 0.6 }],
          bpmOverridden: false,
          noteCount: 4,
          meanConfidence: 0.65,
          lowConfidenceCount: 2,
          downbeatOffsetSeconds: 0,
          warnings: [],
          timings: { match: 0.3 },
        },
        reportMarkdown:
          '# take\n\n- tempo: 92.1 bpm (detected)\n- notes: 4\n- low confidence (below 0.6): 2\n',
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('status-backend')).toHaveText('backend: ok v0.6.0');

  await menuClick(page, 'file', 'file.importAudio');
  const dialog = page.getByTestId('import-dialog');
  await expect(dialog).toBeVisible();
  await page.getByTestId('import-file-input').setInputFiles({
    name: 'take.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF....WAVEfmt '),
  });
  await expect(page.getByTestId('import-list')).toContainText('take.wav');
  await page.getByRole('button', { name: 'import', exact: true }).click();
  await expect(page.locator('[data-import-status="done"]')).toHaveCount(1);
  await expect(page.getByTestId('import-list')).toContainText(
    '4 notes, 92.1 bpm, 2 low confidence',
  );
  await page.getByRole('button', { name: 'report' }).click();
  await expect(page.getByTestId('import-report')).toContainText('low confidence (below 0.6): 2');
  await page.screenshot({ path: screenshotPath('phase-06', 'import-dialog'), fullPage: true });
  await page.getByRole('button', { name: 'close' }).click();

  // The riff is open, tagged imported, and its low-confidence notes draw amber.
  await expect(page.getByTestId('riff-name')).toHaveText('take');
  await expect(page.getByTestId('library-riffs')).toContainText('take');
  await expect(page.locator('.tab-note--low')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // The sounding low-confidence note plus the bar's other low-confidence note as a ghost.
  await expect(page.locator('.fb-note--low')).toHaveCount(2);
  await page.screenshot({ path: screenshotPath('phase-06', 'imported-riff'), fullPage: true });
  expect(console.errors).toEqual([]);
});

test('import is disabled with a reason when the backend is down', async ({ page }) => {
  const console = watchConsole(page);
  // A 200 that does not say ok rather than a refused socket or a 5xx: both of those log a
  // browser console error, and this suite treats any console error as a failure.
  await page.route('**/health', (route) => route.fulfill({ json: { status: 'down' } }));
  await page.goto('/');
  await expect(page.getByTestId('status-backend')).toContainText('backend: unreachable');
  await page.locator('[data-menu="file"]').click();
  const item = page.locator('[data-menu-item="file.importAudio"]');
  await expect(item).toHaveAttribute('aria-disabled', 'true');
  await expect(item).toHaveAttribute('title', /backend unreachable at/);
  await page.keyboard.press('Escape');
  expect(console.errors).toEqual([]);
});

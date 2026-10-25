import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * The AI layer against a mocked backend (P7.T6): analyze labels the dyads, suggestions
 * appear as cards, audition plays without touching the riff, accept is one undo step.
 */
const tuning = { name: 'Bb Standard', pitches: [34, 39, 44, 49, 53, 58] };

function chug(id: string, start: number, lowFret: number) {
  return [
    {
      id: `${id}a`,
      string: 6,
      fret: lowFret,
      start,
      duration: 240,
      velocity: 100,
      techniques: ['palmMute'],
      chordId: id,
    },
    {
      id: `${id}b`,
      string: 5,
      fret: lowFret + 2,
      start,
      duration: 240,
      velocity: 100,
      techniques: ['palmMute'],
      chordId: id,
    },
  ];
}

function variation(name: string, lowFret: number) {
  return {
    format: 'riff-spaced/riff',
    version: 1,
    id: `ai-${name}`,
    name,
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    tuning,
    tempo: { bpm: 92 },
    timeSignature: { beats: 4, unit: 4 },
    ppq: 480,
    lengthBars: 4,
    sections: [{ id: 's', label: 'A', startBar: 0, lengthBars: 4, kind: 'variation' }],
    notes: [
      ...chug('c1', 0, lowFret),
      ...chug('c2', 480, lowFret),
      ...chug('c3', 960, lowFret + 1),
      ...chug('c4', 1440, lowFret),
      ...chug('c5', 1920, lowFret),
      ...chug('c6', 2400, lowFret - 1),
    ],
    tags: ['ai'],
    source: { type: 'ai', model: 'fake', promptVersion: 1, parentRiffId: 'demo-riff-walkdown' },
  };
}

async function mockBackend(page: Page) {
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', version: '0.7.0', aiConfigured: true } }),
  );
  await page.route('**/ai/analyze', async (route) => {
    const riff = route.request().postDataJSON() as { notes: { chordId?: string }[] };
    const ids = [...new Set(riff.notes.map((n) => n.chordId).filter(Boolean))] as string[];
    await route.fulfill({
      json: {
        dyads: ids.map((chordId, i) => ({
          chordId,
          label: (i + 1) % 8 === 7 ? 'P4' : 'P5',
          altLabels: [],
          root: 'Db',
          inverted: (i + 1) % 8 === 7,
          source: i === 3 ? 'computed' : 'model',
        })),
        style: {
          keyCenterGuess: 'Db',
          modeGuess: 'chromatic minor, blues-turnaround feel',
          chromaticDevices: ['chromatic descent in half steps', 'held note against a moving bass'],
          turnaroundDetected: true,
          summary:
            'Palm-muted Db power chords with the inverted fourth on the and of 4, then the turnaround: Ab held while the low string walks Eb D Db C.',
        },
        warnings: [],
        model: 'fake',
        promptVersion: 1,
        usage: { purpose: 'analyze', model: 'fake', inputTokens: 10, outputTokens: 5, attempts: 1 },
      },
    });
  });
  await page.route('**/ai/suggest', async (route) => {
    const body = route.request().postDataJSON() as { kind: string; count: number };
    const names =
      body.kind === 'tunings'
        ? ['Walkdown in Drop Ab', 'Walkdown in A Standard', 'Walkdown in B Standard']
        : ['Walkdown (variation 1)', 'Walkdown (variation 2)'];
    await route.fulfill({
      json: {
        kind: body.kind,
        suggestions: names.slice(0, body.count).map((name, i) => ({
          riff:
            body.kind === 'tunings'
              ? {
                  ...variation(name, 5),
                  tuning: {
                    name: name.replace('Walkdown in ', ''),
                    pitches: [32 - i, 39, 44, 49, 53, 58],
                  },
                }
              : variation(name, 3 + i),
          rationale: `Idea ${i + 1}: the second chug drops to a tritone and stays there.`,
          playingNotes: 'Keep the palm heavy.',
          repairs: i === 1 ? ['refingered: c3a, c3b to [[6, 4], [5, 6]]'] : [],
        })),
        warnings: [],
        model: 'fake',
        promptVersion: 1,
        usage: null,
      },
    });
  });
}

test('analyze labels every chord in the inspector and above the tab brackets', async ({ page }) => {
  const console = watchConsole(page);
  await mockBackend(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await expect(page.getByTestId('status-backend')).toHaveText('backend: ok v0.7.0');

  await menuClick(page, 'ai', 'ai.analyze');
  const panel = page.getByTestId('analysis-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.ai-analysis__dyad')).toHaveCount(23);
  await expect(panel).toContainText('P4 (inv)');
  await expect(panel).toContainText('turnaround yes');
  await expect(panel).toContainText('chromatic descent');
  await expect(page.locator('.ai-analysis__dyad--computed')).toHaveCount(1);
  // Dyad labels are on by default in the tab; the toggle hides them.
  await expect(page.locator('.tab-dyad-label')).toHaveCount(23);
  await page.screenshot({ path: screenshotPath('phase-07', 'analysis'), fullPage: true });
  await menuClick(page, 'view', 'view.dyadLabels');
  await expect(page.locator('.tab-dyad-label')).toHaveCount(0);
  await menuClick(page, 'view', 'view.dyadLabels');
  // Clicking a chip selects the chord.
  await panel.locator('.ai-analysis__dyad').first().click();
  await expect(page.getByTestId('dyad-info')).toContainText('P5');
  expect(console.errors).toEqual([]);
});

test('suggestions: cards, audition, add as variation, undo, alternate tunings', async ({
  page,
}) => {
  const console = watchConsole(page);
  await mockBackend(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await expect(page.getByTestId('status-backend')).toHaveText('backend: ok v0.7.0');

  await menuClick(page, 'ai', 'ai.variations');
  const drawer = page.getByTestId('suggestions-drawer');
  await expect(drawer).toBeVisible();
  const cards = page.getByTestId('suggestion-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(1)).toContainText('refingered: c3a, c3b');

  // Audition plays the suggestion without changing the riff, and the fretboard shows it.
  await cards.first().getByRole('button', { name: 'audition' }).click();
  await expect(page.getByTestId('status-audition')).toHaveText(
    'auditioning: Walkdown (variation 1)',
  );
  await expect(page.getByRole('button', { name: 'stop', exact: true }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('riff-name')).toHaveText('Walkdown Turnaround');
  await page.screenshot({ path: screenshotPath('phase-07', 'suggestions'), fullPage: true });
  await cards.first().getByRole('button', { name: 'stop' }).click();
  await expect(page.getByTestId('status-audition')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'play' })).toBeVisible();

  // Add as variation: a new section, a longer tab, one undo step.
  const tabWidthBefore = Number(await page.getByTestId('tab-svg').getAttribute('width'));
  await cards.first().getByRole('button', { name: 'add as variation' }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId('sections-panel')).toContainText('bars 5-8');
  await expect(page.getByTestId('sections-panel').locator('li')).toHaveCount(2);
  expect(Number(await page.getByTestId('tab-svg').getAttribute('width'))).toBeGreaterThan(
    tabWidthBefore,
  );
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('sections-panel').locator('li')).toHaveCount(1);
  expect(Number(await page.getByTestId('tab-svg').getAttribute('width'))).toBe(tabWidthBefore);

  // Alternate tunings: three cards, each naming its tuning, variation disabled across tunings.
  await menuClick(page, 'ai', 'ai.tunings');
  await expect(page.locator('[data-kind="tunings"]')).toHaveCount(3);
  await expect(page.locator('[data-kind="tunings"]').first()).toContainText('Drop Ab');
  await expect(
    page.locator('[data-kind="tunings"]').first().getByRole('button', { name: 'add as variation' }),
  ).toBeDisabled();
  await page.screenshot({ path: screenshotPath('phase-07', 'tunings'), fullPage: true });
  expect(console.errors).toEqual([]);
});

test('AI menu is disabled with the key reason when the backend has no key', async ({ page }) => {
  const console = watchConsole(page);
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', version: '0.7.0', aiConfigured: false } }),
  );
  await page.goto('/');
  await expect(page.getByTestId('status-backend')).toHaveText('backend: ok v0.7.0');
  await page.locator('[data-menu="ai"]').click();
  const item = page.locator('[data-menu-item="ai.analyze"]');
  await expect(item).toHaveAttribute('aria-disabled', 'true');
  await expect(item).toHaveAttribute('title', 'ANTHROPIC_API_KEY not set');
  await expect(page.locator('[data-menu-item="ai.settings"]')).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.keyboard.press('Escape');
  // Settings is a themed form dialog, never window.prompt.
  await menuClick(page, 'ai', 'ai.settings');
  await expect(page.getByRole('dialog')).toContainText('AI settings');
  await page.getByLabel('model (blank = server default)').fill('claude-custom');
  await page.getByRole('button', { name: 'save' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(console.errors).toEqual([]);
});

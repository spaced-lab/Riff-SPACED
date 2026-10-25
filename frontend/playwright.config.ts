import { defineConfig, devices } from '@playwright/test';

// The e2e suite is the gate for every UI task. It runs against the Vite dev
// server; `reuseExistingServer` lets a dev server left running during a phase be
// reused instead of failing on the busy port.
export default defineConfig({
  testDir: './e2e',
  // Visual baselines live beside the specs, one folder per spec file (P8.T5).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  outputDir: './test-results',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Local Playwright config — tests run against localhost:3000.
 * Run: npx playwright test --config=playwright.local.config.ts
 */
export default defineConfig({
  testDir: './tests/frontend',
  fullyParallel: false,
  retries: 1,
  timeout: 20_000,
  expect: { timeout: 8_000 },

  reporter: [['list'], ['html', { outputFolder: 'tests/reports/frontend-html', open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 12_000,
    locale: 'ar',
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
    },
  ],

  // Auto-start the dev server if not already running
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000/health',
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      NODE_ENV: 'test',
    },
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config targeting the live Railway deployment.
 * Run: npx playwright test --config=playwright.e2e.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'tests/reports/html' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://whale-marketplace-production.up.railway.app',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    // Force Arabic locale so the server's locale middleware serves Arabic content.
    // Without this, headless Chrome sends Accept-Language: en-US and the app
    // defaults to English, breaking all Arabic text assertions.
    locale: 'ar-PS',
    timezoneId: 'Asia/Jerusalem',
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});

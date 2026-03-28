const { defineConfig, devices } = require('@playwright/test');

const defaultBaseURL = 'https://whale-marketplace-production.up.railway.app';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || defaultBaseURL;
const isProductionTarget = /railway\.app/i.test(baseURL);

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: isProductionTarget ? 1 : 0,
  timeout: 30_000,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'tests/reports/html', open: 'never' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
    ['list'],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
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

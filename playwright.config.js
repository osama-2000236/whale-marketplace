const { defineConfig, devices } = require('@playwright/test');

const localPort = Number(process.env.PLAYWRIGHT_PORT || 3000);
const localBaseUrl = `http://127.0.0.1:${localPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || localBaseUrl;
const isProductionTarget = /railway\.app/i.test(baseURL);
const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL && !process.env.BASE_URL;

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
  webServer: useLocalServer
    ? {
        command: 'node server.js',
        url: localBaseUrl,
        reuseExistingServer: true,
        env: {
          PORT: String(localPort),
          BASE_URL: localBaseUrl,
          NODE_ENV: 'test',
          SESSION_SECRET: 'playwright-session-secret-for-local-runs',
        },
      }
    : undefined,
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

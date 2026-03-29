const { defineConfig, devices } = require('@playwright/test');

const localPort = Number(process.env.PLAYWRIGHT_PORT || 3000);
const localBaseUrl = `http://127.0.0.1:${localPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || localBaseUrl;
const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL && !process.env.BASE_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'tests/reports/html', open: 'never' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
    ['list'],
  ],
  use: {
    baseURL,
    screenshot: 'on',
    video: 'off',
    trace: 'retain-on-failure',
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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
});

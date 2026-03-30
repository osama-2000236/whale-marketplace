const fs = require('node:fs');

const ORIGINAL_ENV = process.env;

function loadConfig(extraEnv = {}) {
  delete process.env.PLAYWRIGHT_BASE_URL;
  delete process.env.BASE_URL;
  delete process.env.PLAYWRIGHT_PORT;

  Object.assign(process.env, extraEnv);

  delete require.cache[require.resolve('../playwright.config')];
  return require('../playwright.config');
}

describe('playwright.config', () => {
  afterAll(() => {
    if (ORIGINAL_ENV.PLAYWRIGHT_BASE_URL === undefined) {
      delete process.env.PLAYWRIGHT_BASE_URL;
    } else {
      process.env.PLAYWRIGHT_BASE_URL = ORIGINAL_ENV.PLAYWRIGHT_BASE_URL;
    }

    if (ORIGINAL_ENV.BASE_URL === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = ORIGINAL_ENV.BASE_URL;
    }

    if (ORIGINAL_ENV.PLAYWRIGHT_PORT === undefined) {
      delete process.env.PLAYWRIGHT_PORT;
    } else {
      process.env.PLAYWRIGHT_PORT = ORIGINAL_ENV.PLAYWRIGHT_PORT;
    }
  });

  test('defaults to localhost-first execution with a managed webServer', () => {
    const config = loadConfig();

    expect(config.use.baseURL).toBe('http://127.0.0.1:3000');
    expect(config.webServer).toEqual(
      expect.objectContaining({
        command: 'node server.js',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
      })
    );
    expect(config.webServer.env).toEqual(
      expect.objectContaining({
        GOOGLE_CLIENT_ID: 'playwright-google-client',
        GOOGLE_CLIENT_SECRET: 'playwright-google-secret',
      })
    );
  });

  test('supports PLAYWRIGHT_BASE_URL and BASE_URL overrides without a local webServer', () => {
    const source = fs.readFileSync(require.resolve('../playwright.config'), 'utf8');

    expect(source).toContain(
      "const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || localBaseUrl;"
    );
    expect(source).toContain(
      'const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL && !process.env.BASE_URL;'
    );
  });

  test('exposes CLI-friendly project names', () => {
    const config = loadConfig();
    const names = config.projects.map((project) => project.name);

    expect(names).toEqual([
      'chromium',
      'firefox',
      'webkit',
      'mobile-chrome',
      'mobile-safari',
      'tablet',
    ]);
  });
});

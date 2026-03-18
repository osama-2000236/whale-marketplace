const { test, expect } = require('@playwright/test');

test('login page renders consistently across browsers', async ({ page, browserName }) => {
  await page.goto('/auth/login');
  const card = page.locator('.auth-card, .login-card');
  await expect(card.first()).toBeVisible();
  const box = await card.first().boundingBox();
  if (box) {
    const vp = page.viewportSize();
    const isMobileViewport = vp ? vp.width < 768 : false;
    const minWidth = isMobileViewport ? 220 : 280;
    const minHeight = isMobileViewport ? 160 : 180;
    expect(box.width, `${browserName}: card width`).toBeGreaterThan(minWidth);
    expect(box.height, `${browserName}: card height`).toBeGreaterThan(minHeight);
  }
});

test('whale logo SVG renders in all browsers', async ({ page, browserName }) => {
  await page.goto('/whale');
  const logo = page.locator('.whale-logo svg, .logo-mark svg').first();
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  expect(box, `${browserName}: logo not visible`).not.toBeNull();
  if (box) expect(box.width, `${browserName}: logo width`).toBeGreaterThan(10);
});

test('CSS listing layout works in all browsers', async ({ page, browserName }) => {
  await page.goto('/whale');
  const grid = page.locator('.listing-grid');
  if ((await grid.count()) === 0) return;
  const display = await grid.evaluate((el) => window.getComputedStyle(el).display);
  expect(['grid', 'flex'], `${browserName}: listing layout`).toContain(display);
});

test('Arabic text direction is set for listing titles in all browsers', async ({ page, browserName }) => {
  await page.goto('/whale');
  const titles = page.locator('.listing-title');
  if ((await titles.count()) === 0) return;
  const dir = await titles.first().getAttribute('dir');
  expect(['auto', 'rtl'], `${browserName}: dir`).toContain(dir);
});

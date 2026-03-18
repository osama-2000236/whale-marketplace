const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');

test('marketplace page: loads without JS errors', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));
  await page.goto('/whale');
  await page.waitForLoadState('networkidle');
  expect(jsErrors).toHaveLength(0);
});

test('marketplace page: search bar is visible and usable', async ({ page }) => {
  await page.goto('/whale');
  await expect(page.locator('input[name="q"], .whale-nav-search input, input[type="search"]').first()).toBeVisible();
});

test('marketplace page: category controls render', async ({ page }) => {
  await page.goto('/whale');
  const count = await page.locator('.filter-option, .cat-chip').count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('marketplace page: listing images load — no broken images', async ({ page }) => {
  await page.goto('/whale');
  await page.waitForLoadState('networkidle');
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.listing-card img, .listing-img'));
    return imgs.filter((img) => !img.complete || img.naturalWidth === 0).length;
  });
  expect(broken).toBe(0);
});

test('marketplace page: price is displayed with NIS symbol (₪)', async ({ page }) => {
  await page.goto('/whale');
  const price = await page.locator('.listing-price').first().textContent();
  if (price) {
    expect(price).toMatch(/₪/);
  }
});

test('marketplace page: search/filter updates URL', async ({ page }) => {
  await page.goto('/whale');
  const input = page.locator('input[name="q"]').first();
  await input.fill('RTX');
  await input.press('Enter');
  await page.waitForTimeout(500);
  expect(page.url().toLowerCase()).toContain('rtx');
});

test('marketplace page: guest sees register CTA and not direct sell form action', async ({ page }) => {
  await page.goto('/whale');
  const sellForms = await page.locator('form[action="/whale/sell"]').count();
  const bodyText = (await page.textContent('body')) || '';
  expect(sellForms).toBe(0);
  expect(/register|welcome|مجاناً|sell/i.test(bodyText)).toBe(true);
});

test('marketplace page: listing card has required elements', async ({ page }) => {
  await page.goto('/whale');
  const firstCard = page.locator('.listing-card').first();
  if ((await firstCard.count()) === 0) return;

  const hasPrice = (await firstCard.locator('.listing-price').count()) > 0;
  const hasTitle = (await firstCard.locator('.listing-title').count()) > 0;
  const hasLocation = (await firstCard.locator('.listing-location, .listing-meta').count()) > 0;
  const hasImage = (await firstCard.locator('img').count()) > 0;

  expect(hasPrice).toBe(true);
  expect(hasTitle).toBe(true);
  expect(hasLocation).toBe(true);
  expect(hasImage).toBe(true);
});

test('marketplace page: add listing button visible to Pro user', async ({ page }) => {
  await loginAs(page);
  await page.goto('/whale');
  const add = page.locator('a[href="/whale/sell"].btn, a[href="/whale/sell"]:has-text("+"), a[href="/whale/sell"]:has-text("نشر")');
  expect(await add.count()).toBeGreaterThan(0);
});

test('listing detail page: trust/buyer-protection text is visible', async ({ page }) => {
  await page.goto('/whale');
  const firstCard = page.locator('.listing-card').first();
  if ((await firstCard.count()) === 0) return;
  await firstCard.scrollIntoViewIfNeeded();
  const firstLink = firstCard.locator('a[href^="/whale/listing/"]').first();
  const href = await firstLink.getAttribute('href');
  if (!href) return;
  await page.goto(href);
  await page.waitForLoadState('domcontentloaded');

  const bodyText = (await page.textContent('body')) || '';
  expect(/محفوظة|protected|trust|buyer protection|escrow/i.test(bodyText)).toBe(true);
});

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth');

test('primary button changes appearance on hover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('Mobile'), 'Hover states are desktop-only.');

  await page.goto('/auth/login');
  const btn = page.locator('button[type="submit"], .btn-primary').first();
  const bgBefore = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  await btn.hover();
  await page.waitForTimeout(150);
  const bgAfter = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  const transformAfter = await btn.evaluate((el) => window.getComputedStyle(el).transform);
  const shadowAfter = await btn.evaluate((el) => window.getComputedStyle(el).boxShadow);

  expect(bgBefore !== bgAfter || transformAfter !== 'none' || shadowAfter !== 'none').toBe(true);
});

test('listing card lifts on hover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('Mobile'), 'Hover states are desktop-only.');

  await page.goto('/whale');
  const card = page.locator('.listing-card').first();
  if ((await card.count()) === 0) return;

  const shadowBefore = await card.evaluate((el) => window.getComputedStyle(el).boxShadow);
  await card.hover();
  await page.waitForTimeout(200);
  const shadowAfter = await card.evaluate((el) => window.getComputedStyle(el).boxShadow);
  const transformAfter = await card.evaluate((el) => window.getComputedStyle(el).transform);

  expect(shadowBefore !== shadowAfter || transformAfter !== 'none').toBe(true);
});

test('input fields show visible focus ring', async ({ page }) => {
  await page.goto('/auth/login');
  const input = page.locator('input[name="identifier"]');
  const borderBefore = await input.evaluate((el) => window.getComputedStyle(el).borderColor);
  const shadowBefore = await input.evaluate((el) => window.getComputedStyle(el).boxShadow);
  await input.focus();
  await page.waitForTimeout(120);
  const borderAfter = await input.evaluate((el) => window.getComputedStyle(el).borderColor);
  const shadowAfter = await input.evaluate((el) => window.getComputedStyle(el).boxShadow);

  expect(borderBefore !== borderAfter || shadowBefore !== shadowAfter).toBe(true);
});

test('save (heart) button toggles state on click', async ({ page }) => {
  await loginAs(page);
  await page.goto('/whale');
  const saveBtn = page.locator('.save-btn').first();
  if ((await saveBtn.count()) === 0) return;

  await page.waitForTimeout(200);
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/save') && resp.request().method() === 'POST'
  );
  await saveBtn.click();
  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));

  expect(response.ok()).toBe(true);
  expect(typeof payload.saved).toBe('boolean');
});

test('navbar active link highlighted on current page', async ({ page }) => {
  await page.goto('/whale');
  const active = await page.evaluate(() => {
    const links = document.querySelectorAll('.whale-nav-links a');
    for (const link of links) {
      if (link.classList.contains('active') || link.getAttribute('aria-current') === 'page') {
        return true;
      }
    }
    return false;
  });
  expect(active).toBe(true);
});

test('clicking category chip updates listing grid when chips exist', async ({ page }) => {
  await page.goto('/whale');
  const chip = page.locator('.cat-chip').nth(1);
  if ((await chip.count()) === 0) return;

  const before = page.url();
  await chip.click();
  await page.waitForTimeout(500);
  const after = page.url();
  expect(after !== before).toBe(true);
});

test('toast appears and auto-dismisses when present', async ({ page }) => {
  await loginAs(page);
  await page.goto('/whale');

  const toast = page.locator('.toast, #toast-container .toast');
  if ((await toast.count()) === 0) return;

  await expect(toast.first()).toBeVisible();
  await page.waitForTimeout(5500);
  const stillVisible = await toast.first().isVisible().catch(() => false);
  expect(stillVisible).toBe(false);
});

test('empty login form does not crash with blank/500 page', async ({ page }) => {
  await page.goto('/auth/login');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);

  const title = await page.title();
  const bodyText = (await page.textContent('body')) || '';
  expect(bodyText.trim().length < 20).toBe(false);
  expect(/500|error/i.test(title)).toBe(false);
});

test('wrong password shows error message', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('input[name="identifier"]', 'nonexistent_user_xyz');
  await page.fill('input[name="password"]', 'wrongpassword123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);

  const hasError = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return /error|wrong|invalid|غلط|خطأ|incorrect|غير صحيحة/i.test(text);
  });
  expect(hasError).toBe(true);
});

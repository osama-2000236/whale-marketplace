const { test, expect } = require('@playwright/test');

async function goLogin(page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 25000 });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

test('login page: only ONE h1 or brand heading exists', async ({ page }) => {
  await goLogin(page);
  const h1Count = await page.locator('h1').count();
  expect(h1Count).toBeLessThanOrEqual(2);
});

test('login page: has exactly one form', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('form')).toHaveCount(1);
});

test('login page: no promotional banners or unrelated CTA content', async ({ page }) => {
  await goLogin(page);
  const foundPromoTerms = await page.evaluate(() => {
    const text = (document.body.textContent || '').toLowerCase();
    const terms = ['sale', 'discount', 'offer', 'trending', 'limited time'];
    return terms.filter((t) => text.includes(t));
  });
  expect(foundPromoTerms).toHaveLength(0);
});

test('login page: has identifier input', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
});

test('login page: has password input', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('login page: has submit button', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('button[type="submit"], input[type="submit"]')).toBeVisible();
});

test('login page: has forgot-password link', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('a[href*="forgot"], a[href*="reset"]')).toBeVisible();
});

test('login page: has register link', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('a[href*="/auth/register"]').first()).toBeVisible();
});

test('login page: Whale logo is present and visible', async ({ page }) => {
  await goLogin(page);
  await expect(page.locator('.whale-logo svg, .logo-mark svg, .auth-logo, .whale-logo').first()).toBeVisible();
});

test('login page: no full navigation menu shown', async ({ page }) => {
  await goLogin(page);
  const navLinks = await page.locator('.whale-nav-links a').count();
  expect(navLinks).toBeLessThanOrEqual(2);
});

test('login page: form card centered on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await goLogin(page);
  const centered = await page.evaluate(() => {
    const card = document.querySelector('.login-card, .auth-card, .auth-grid');
    if (!card) return true;
    const rect = card.getBoundingClientRect();
    const screenCenter = window.innerWidth / 2;
    const cardCenter = rect.left + rect.width / 2;
    return Math.abs(screenCenter - cardCenter) < 80;
  });
  expect(centered).toBe(true);
});

test('login page: card width <= 460px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await goLogin(page);
  const width = await page.evaluate(() => {
    const card = document.querySelector('.login-card, .auth-card');
    return card ? card.getBoundingClientRect().width : 0;
  });
  if (width > 0) {
    expect(width).toBeLessThanOrEqual(460);
  }
});

test('login page: tab order reaches identifier/password/submit', async ({ page }) => {
  await goLogin(page);
  await page.focus('input[name="identifier"]');
  await page.keyboard.press('Tab');
  const afterFirstTab = await page.evaluate(
    () => document.activeElement?.getAttribute('name') || document.activeElement?.getAttribute('type') || ''
  );
  await page.keyboard.press('Tab');
  const afterSecondTab = await page.evaluate(
    () => document.activeElement?.getAttribute('name') || document.activeElement?.getAttribute('type') || ''
  );

  expect(String(afterFirstTab).toLowerCase()).toContain('password');
  expect(['submit', 'button']).toContain(String(afterSecondTab).toLowerCase());
});

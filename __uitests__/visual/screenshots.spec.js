const { test, expect } = require('@playwright/test');

async function maskDynamicBits(page) {
  await page.addStyleTag({
    content: `
      .listing-time,
      .icon-dot,
      .badge-ocean,
      [data-dynamic-time] {
        visibility: hidden !important;
      }
    `
  });
}

test('@visual login page matches baseline', async ({ page }) => {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await maskDynamicBits(page);
  await expect(page).toHaveScreenshot('login-page.png', {
    fullPage: false,
    maxDiffPixels: 150,
    threshold: 0.03
  });
});

test('@visual marketplace guest view matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/whale');
  await page.waitForLoadState('networkidle');
  await maskDynamicBits(page);
  await expect(page).toHaveScreenshot('marketplace-guest.png', {
    fullPage: false,
    maxDiffPixels: 800,
    threshold: 0.05
  });
});

test('@visual marketplace mobile view matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  await page.waitForLoadState('networkidle');
  await maskDynamicBits(page);
  await expect(page).toHaveScreenshot('marketplace-mobile.png', {
    fullPage: false,
    maxDiffPixels: 500,
    threshold: 0.05
  });
});

test('@visual listing card hover state captured', async ({ page }, testInfo) => {
  await page.goto('/whale');
  await maskDynamicBits(page);
  const card = page.locator('.listing-card').first();
  if ((await card.count()) === 0) return;
  await card.hover();
  await page.waitForTimeout(250);
  await expect(card).toHaveScreenshot('listing-card-hover.png', {
    maxDiffPixels: 350,
    threshold: 0.05
  });
});

import { expect, test } from '@playwright/test';

test.describe('UI language toggle', () => {
  test('AR/EN toggle exists in navbar', async ({ page }) => {
    // Intent: verify the live public navbar exposes the locale switch control.
    await page.goto('/');

    await expect(page.locator('[data-locale]')).toBeVisible();
  });

  test('EN mode shows English text', async ({ page }) => {
    // Intent: verify clicking the locale toggle transitions into English and clears stale lang query state.
    await page.goto('/?lang=ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect
      .poll(() => new URL(page.url()).searchParams.has('lang'))
      .toBe(false);

    await page.locator('[data-locale="en"]').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect
      .poll(() => new URL(page.url()).searchParams.has('lang'))
      .toBe(false);
    await expect(page.locator('.navbar-nav a[href="/whale"]')).toHaveText('Browse');
  });

  test('AR mode applies dir="rtl" on html element', async ({ page }) => {
    // Intent: verify the Arabic locale can be restored and the stale lang query value is removed after switching.
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect
      .poll(() => new URL(page.url()).searchParams.has('lang'))
      .toBe(false);

    await page.locator('[data-locale="ar"]').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect
      .poll(() => new URL(page.url()).searchParams.has('lang'))
      .toBe(false);
    await expect(page.locator('.hero h1')).toHaveText(/(اشترِ وبِع بأمان|Buy and Sell with Confidence)/);
  });
});

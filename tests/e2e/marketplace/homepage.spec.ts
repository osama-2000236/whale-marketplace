import { expect, test } from '@playwright/test';

test.describe('Marketplace homepage', () => {
  test('Hero heading renders', async ({ page }) => {
    // Intent: verify the production homepage renders the exact hero heading currently exposed in the live Arabic UI.
    await page.goto('/');

    await expect(page.locator('.hero h1')).toHaveText(
      /(اشترِ وبِع بأمان|Buy and Sell with Confidence)/
    );
  });

  test('Browse CTA links to /whale', async ({ page }) => {
    // Intent: verify the primary browse CTA points to the live browse route rather than a stale or broken path.
    await page.goto('/');

    await expect(page.locator('.hero-actions a[href="/whale"]')).toHaveAttribute('href', '/whale');
  });

  test('Sell CTA links to /whale/sell', async ({ page }) => {
    // Intent: verify the public sell CTA points to the guarded sell entry route used by the live app.
    await page.goto('/');

    await expect(page.locator('.hero-actions a[href="/whale/sell"]')).toHaveAttribute(
      'href',
      '/whale/sell'
    );
  });

  test('All 6 category tiles render with correct hrefs', async ({ page }) => {
    // Intent: verify the production homepage shows the full category tile set and each tile links to the expected browse filter.
    await page.goto('/');

    const expectedHrefs = [
      '/whale?category=electronics',
      '/whale?category=vehicles',
      '/whale?category=real-estate',
      '/whale?category=fashion',
      '/whale?category=home-garden',
      '/whale?category=sports',
    ];

    const tiles = page.locator('.grid-categories .category-card');
    await expect(tiles).toHaveCount(6);

    for (const href of expectedHrefs) {
      await expect(page.locator(`.grid-categories .category-card[href="${href}"]`)).toBeVisible();
    }
  });

  test('"Why Whale?" section renders', async ({ page }) => {
    // Intent: verify the trust/value proposition section is present with its live heading and cards.
    await page.goto('/');

    await expect(page.locator('.trust-grid')).toBeVisible();
    await expect(page.locator('h2.section-title.text-center')).toHaveText(/(لماذا الحوت؟|Why Whale\?)/);
    await expect(page.locator('.trust-grid .trust-card')).toHaveCount(3);
  });

  test('Latest products section shows at least 1 listing card', async ({ page }) => {
    // Intent: verify the homepage recent-listings surface is populated on the live deployment.
    await page.goto('/');

    await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();
  });

  test('Each card has title, price, location, category, condition', async ({ page }) => {
    // Intent: verify the live listing card component includes the critical marketplace metadata users need before click-through.
    await page.goto('/');

    const firstCard = page.locator('.grid-listings .listing-card').first();
    await expect(firstCard.locator('.listing-card-title')).toBeVisible();
    await expect(firstCard.locator('.listing-card-price')).toContainText('$');
    await expect(firstCard.locator('.listing-card-meta span').first()).toBeVisible();
    await expect(firstCard.locator('.listing-card-meta span').nth(2)).toBeVisible();
    await expect(firstCard.locator('.listing-card-badge .badge')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('Marketplace browse', () => {
  test('/whale renders a listing grid', async ({ page }) => {
    // Intent: verify the live browse route loads its filter sidebar and listing grid without requiring auth.
    await page.goto('/whale');

    await expect(page.locator('.filter-sidebar')).toBeVisible();
    await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();
  });

  test('Cards are clickable -> /whale/listing/[slug]', async ({ page }) => {
    // Intent: verify a live listing card can be followed through to its detail route using the real card href.
    await page.goto('/whale');

    const firstCard = page.locator('.grid-listings .listing-card').first();
    const href = await firstCard.getAttribute('href');

    expect(href).toMatch(/^\/whale\/listing\/[^/]+$/);

    await Promise.all([
      page.waitForURL(new RegExp(`${href?.replace(/\//g, '\\/')}$`)),
      firstCard.click(),
    ]);
    await expect(page.locator('.listing-detail')).toBeVisible();
  });

  test('Cards show required fields', async ({ page }) => {
    // Intent: verify the browse cards expose the same required metadata as the homepage cards on the live deployment.
    await page.goto('/whale');

    const firstCard = page.locator('.grid-listings .listing-card').first();
    await expect(firstCard.locator('.listing-card-title')).toBeVisible();
    await expect(firstCard.locator('.listing-card-price')).toContainText('$');
    await expect(firstCard.locator('.listing-card-meta span').first()).toBeVisible();
    await expect(firstCard.locator('.listing-card-meta span').nth(2)).toBeVisible();
    await expect(firstCard.locator('.listing-card-badge .badge')).toBeVisible();
  });
});

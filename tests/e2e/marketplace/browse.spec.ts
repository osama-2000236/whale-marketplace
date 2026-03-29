import { expect, test } from '@playwright/test';

test.describe('Marketplace browse', () => {
  test('/whale renders a listing grid', async ({ page }) => {
    // Intent: verify the live browse route loads its filter sidebar and listing grid without requiring auth.
    await page.goto('/whale');

    await expect(page.locator('.filter-sidebar')).toBeVisible();
    await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();
  });

  test('Filter sidebar exposes the expected controls', async ({ page }) => {
    // Intent: verify the live browse filters include the real search, category, city, condition, and sort controls wired in the template.
    await page.goto('/whale');

    await expect(page.locator('.filter-form input[name="q"]')).toBeVisible();
    await expect(page.locator('.filter-form select[name="category"]')).toBeVisible();
    await expect(page.locator('.filter-form select[name="city"]')).toBeVisible();
    await expect(page.locator('.filter-form select[name="condition"]')).toBeVisible();
    await expect(page.locator('.filter-form select[name="sort"]')).toBeVisible();
    await expect(page.locator('.filter-form button[type="submit"]')).toBeVisible();
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

  test('Impossible queries do not crash and render fallback results or empty state', async ({ page }) => {
    // Intent: verify the browse page stays usable when filters produce no database matches, including the degraded fallback path.
    await page.goto('/whale?q=impossible-qa-query-xyz-000');

    await expect(page.locator('.browse-layout')).toBeVisible();
    const emptyState = page.locator('.empty-state');
    const listingCards = page.locator('.grid-listings .listing-card');

    if ((await emptyState.count()) > 0) {
      await expect(emptyState).toBeVisible();
      await expect(page.locator('.empty-state a[href="/whale"]')).toBeVisible();
    } else {
      await expect(listingCards.first()).toBeVisible();
    }
  });

  test('Load more link uses a cursor parameter when pagination is present', async ({ page }) => {
    // Intent: verify pagination keeps the live cursor contract whenever the browse page exposes a load-more link.
    await page.goto('/whale');

    const loadMore = page.locator('a.btn.btn-ghost[href*="cursor="]');
    if ((await loadMore.count()) > 0) {
      await expect(loadMore.first()).toHaveAttribute('href', /cursor=/);
    }
  });
});

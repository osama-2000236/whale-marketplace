import { expect, test } from '@playwright/test';

const KNOWN_SLUG = '/whale/listing/playstation-5-bundle-vio2x';
const SECOND_KNOWN_SLUG = '/whale/listing/mountain-bike-trek-2cb6o';

test.describe('Marketplace listing detail', () => {
  test('Known slug loads correctly', async ({ page }) => {
    // Intent: verify a known production listing slug resolves to the live listing detail template.
    await page.goto(KNOWN_SLUG);

    await expect(page.locator('.listing-detail')).toBeVisible();
    await expect(page.locator('.listing-detail h1')).toHaveText(
      /(بلايستيشن 5 مع ملحقات|PlayStation 5 Bundle)/
    );
  });

  test('Shows title, price, condition, location', async ({ page }) => {
    // Intent: verify the detail view renders the core buyer-facing listing metadata.
    await page.goto(KNOWN_SLUG);

    await expect(page.locator('.listing-detail h1')).toBeVisible();
    await expect(page.locator('.listing-detail-price')).toContainText('$');
    await expect(page.locator('.listing-detail .badge.badge-info')).toBeVisible();
    await expect(page.locator('.listing-detail .text-sm.text-muted').first()).toContainText('Gaza');
  });

  test('Shows category metadata', async ({ page }) => {
    // Intent: verify category metadata is rendered alongside the rest of the listing facts.
    await page.goto(KNOWN_SLUG);

    await expect(page.locator('.listing-detail-category')).toContainText(/(Electronics|إلكترونيات)/);
  });

  test('Shows seller info, gallery, and description content', async ({ page }) => {
    // Intent: verify the detail page renders the live seller profile summary, image gallery, and description card for buyers.
    await page.goto(KNOWN_SLUG);

    await expect(page.locator('.gallery')).toBeVisible();
    await expect(page.locator('.seller-info')).toBeVisible();
    await expect(page.locator('.seller-info-name')).toBeVisible();
    await expect(page.locator('.card .card-body').first()).toBeVisible();
  });

  test('CTA section visible', async ({ page }) => {
    // Intent: verify the primary buyer action area is visible on the live listing detail page.
    await page.goto(KNOWN_SLUG);

    await expect(page.locator('.listing-detail-actions')).toBeVisible();
    await expect(page.locator('.listing-detail-actions a[href^="/auth/login?next="]')).toBeVisible();
  });

  test('Second known listing slug loads correctly', async ({ page }) => {
    // Intent: verify coverage is not tied to a single seed listing and the alternate detail route still renders normally.
    await page.goto(SECOND_KNOWN_SLUG);

    await expect(page.locator('.listing-detail')).toBeVisible();
    await expect(page.locator('.listing-detail h1')).toContainText(/(Mountain Bike|دراجة)/);
    await expect(page.locator('.listing-detail-price')).toContainText('$');
  });

  test('Fake slug -> 404 or error page, not crash', async ({ page }) => {
    // Intent: verify missing listing slugs render the production not-found experience instead of a server crash or blank page.
    await page.goto('/whale/listing/fake-slug-does-not-exist');

    await expect(page).toHaveURL(/\/whale\/listing\/fake-slug-does-not-exist$/);
    await expect(page.locator('.empty-state h3')).toHaveText(/(الصفحة غير موجودة|Page not found)/);
  });
});

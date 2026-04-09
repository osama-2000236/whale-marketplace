import { expect, test } from '@playwright/test';
import { addCurrentListingToCart, registerTestUser } from '../helpers/auth.helper';

const PRIMARY_LISTING_SLUG = '/whale/listing/playstation-5-bundle-vio2x';
const SECONDARY_LISTING_SLUG = '/whale/listing/mountain-bike-trek-2cb6o';

async function fillCheckoutAddress(page) {
  await page.locator('input[name="street"]').fill('123 QA Street');
  await page.locator('select[name="city"]').selectOption('Gaza');
  await page.locator('input[name="phone"]').fill('0599123456');
}

test.describe('Marketplace checkout', () => {
  test('Direct manual checkout places an order', async ({ page }) => {
    // Intent: verify a verified user can complete the direct buy-now flow with the manual payment method and land on the order detail page.
    await registerTestUser(page);
    await page.goto(PRIMARY_LISTING_SLUG);

    await Promise.all([
      page.waitForURL(/\/whale\/checkout\/[^/]+$/),
      page.locator('.listing-detail-actions a[href^="/whale/checkout/"]').click(),
    ]);

    await fillCheckoutAddress(page);
    await page.locator('select[name="paymentMethod"]').selectOption('manual');

    await Promise.all([
      page.waitForURL(/\/whale\/orders\/[^/]+$/),
      page.locator('form[action^="/whale/checkout/"] button[type="submit"]').click(),
    ]);

    await expect(page.locator('.timeline')).toBeVisible();
    await expect(page.locator('.flash.flash-success')).toBeVisible();
  });

  test('Cart manual checkout places one order per listing and redirects to buying orders', async ({
    page,
  }) => {
    // Intent: verify the cart flow can reserve multiple listings, complete manual checkout, and land on the buying orders list.
    await registerTestUser(page);

    await page.goto(PRIMARY_LISTING_SLUG);
    await addCurrentListingToCart(page, 1);

    await page.goto(SECONDARY_LISTING_SLUG);
    await addCurrentListingToCart(page, 1);

    await page.goto('/cart');
    await expect(page.locator('a[href="/checkout"]')).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/checkout$/),
      page.locator('a[href="/checkout"]').click(),
    ]);

    await fillCheckoutAddress(page);
    await page.locator('select[name="paymentMethod"]').selectOption('manual');

    await Promise.all([
      page.waitForURL(/\/whale\/orders\?tab=buying$/),
      page.locator('form[action="/checkout"] button[type="submit"]').click(),
    ]);

    await expect(page.locator('.tabs .tab.active')).toContainText(/(My Purchases|Buying|شراء)/);
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });
});

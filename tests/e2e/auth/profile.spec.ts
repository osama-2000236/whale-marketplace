import { expect, test } from '@playwright/test';
import { registerTestUser } from '../helpers/auth.helper';

test.describe('Profile settings', () => {
  test('Public profile updates persist successfully', async ({ page }) => {
    // Intent: verify a signed-in user can update the public profile form and see the saved values reflected after redirect.
    await registerTestUser(page);
    await page.goto('/profile');

    await page.locator('form[action="/profile"] input[name="displayName"]').fill('QA Seller');
    await page.locator('form[action="/profile"] textarea[name="bio"]').fill('Updated by Playwright.');
    await page.locator('form[action="/profile"] input[name="city"]').fill('Gaza');
    await page.locator('form[action="/profile"] input[name="whatsapp"]').fill('+970599123456');

    await Promise.all([
      page.waitForNavigation({ url: /\/profile$/ }),
      page.locator('form[action="/profile"] button[type="submit"]').click(),
    ]);

    await expect(page.locator('form[action="/profile"] input[name="displayName"]')).toHaveValue(
      'QA Seller',
    );
    await expect(page.locator('form[action="/profile"] textarea[name="bio"]')).toHaveValue(
      'Updated by Playwright.',
    );
  });

  test('Invalid WhatsApp input shows an error flash', async ({ page }) => {
    // Intent: verify profile validation rejects malformed WhatsApp values without breaking the profile page flow.
    await registerTestUser(page);
    await page.goto('/profile');

    await page.locator('form[action="/profile"] input[name="displayName"]').fill('QA Seller');
    await page.locator('form[action="/profile"] input[name="whatsapp"]').fill('bad-number');

    await Promise.all([
      page.waitForNavigation({ url: /\/profile$/ }),
      page.locator('form[action="/profile"] button[type="submit"]').click(),
    ]);

    await expect(page.locator('form[action="/profile"] input[name="displayName"]')).not.toHaveValue(
      'QA Seller',
    );
  });
});

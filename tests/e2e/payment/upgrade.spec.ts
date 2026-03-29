import { expect, test } from '@playwright/test';
import { registerTestUser } from '../helpers/auth.helper';

test.describe('Upgrade payment entry', () => {
  test('Upgrade page stays usable when no hosted payment providers are configured locally', async ({ page }) => {
    // Intent: verify the local fallback server renders the upgrade surface cleanly and communicates that hosted providers are unavailable.
    await registerTestUser(page);
    await page.goto('/upgrade');

    await expect(page.locator('h1')).toContainText(/(Upgrade|ترقية)/);
    await expect(page.locator('text=No online payment providers are configured right now.')).toHaveCount(3);
  });
});

import { expect, test } from '@playwright/test';

test.describe('Security auth guards', () => {
  test('/whale/sell redirects unauthenticated users to /auth/login', async ({ page }) => {
    // Intent: verify the live sell route keeps its authentication guard in place.
    await page.goto('/whale/sell');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Fsell$/);
  });

  test('<script>alert(1)</script> in input does not execute JS', async ({ page }) => {
    // Intent: verify reflected input handling does not execute injected script content during a failed live login attempt.
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.goto('/auth/login');
    await page.locator('input[name="identifier"]').fill('<script>alert(1)</script>');
    await page.locator('input[name="password"]').fill('QATestWhale2026!');

    await Promise.all([
      page.waitForURL(/\/auth\/login$/),
      page.locator('form[action="/auth/login"] button').click(),
    ]);

    expect(dialogSeen).toBe(false);
    await expect(page.locator('.flash.flash-danger')).toBeVisible();
  });

  test('SQL injection in login field does not crash app', async ({ page }) => {
    // Intent: verify a classic SQL injection payload is handled as plain text and leaves the live app responsive.
    await page.goto('/auth/login');
    await page.locator('input[name="identifier"]').fill("' OR 1=1 --");
    await page.locator('input[name="password"]').fill('QATestWhale2026!');

    await Promise.all([
      page.waitForURL(/\/auth\/login$/),
      page.locator('form[action="/auth/login"] button').click(),
    ]);

    await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
    await expect(page.locator('.flash.flash-danger')).toBeVisible();
  });
});

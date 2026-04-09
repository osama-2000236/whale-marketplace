import { expect, test } from '@playwright/test';
import { ensureLoginFormVisible, registerTestUser } from '../helpers/auth.helper';

test.describe('Security auth guards', () => {
  test('/whale/sell redirects unauthenticated users to /auth/login', async ({ page }) => {
    // Intent: verify the live sell route keeps its authentication guard in place.
    await page.goto('/whale/sell');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Fsell$/);
  });

  test('/whale/dashboard redirects unauthenticated users to /auth/login', async ({ page }) => {
    // Intent: verify the live dashboard route preserves its auth guard for anonymous visitors.
    await page.goto('/whale/dashboard');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Fdashboard$/);
  });

  test('/whale/orders redirects unauthenticated users to /auth/login', async ({ page }) => {
    // Intent: verify the live orders route preserves its auth guard for anonymous visitors.
    await page.goto('/whale/orders');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Forders$/);
  });

  test('/checkout redirects unauthenticated users to /auth/login', async ({ page }) => {
    // Intent: verify the cart checkout route preserves its auth guard for anonymous visitors.
    await page.goto('/checkout');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcheckout$/);
  });

  test('/admin blocks authenticated non-admin users', async ({ page }) => {
    // Intent: verify the live admin area remains protected even after a normal user signs in successfully.
    await registerTestUser(page);
    const response = await page.goto('/admin');

    expect(response?.status()).toBe(403);
    await expect(page.locator('.empty-state h3')).toContainText('403');
  });

  test('<script>alert(1)</script> in input does not execute JS', async ({ page }) => {
    // Intent: verify reflected input handling does not execute injected script content during a failed live login attempt.
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await page.goto('/auth/login');
    await ensureLoginFormVisible(page);
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
    await ensureLoginFormVisible(page);
    await page.locator('input[name="identifier"]').fill("' OR 1=1 --");
    await page.locator('input[name="password"]').fill('QATestWhale2026!');

    await Promise.all([
      page.waitForURL(/\/auth\/login$/),
      page.locator('form[action="/auth/login"] button').click(),
    ]);

    await ensureLoginFormVisible(page);
    await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
    await expect(page.locator('.flash.flash-danger')).toBeVisible();
  });

  test('SQL injection in search query does not crash browse', async ({ page }) => {
    // Intent: verify the browse query parser handles SQL-like payloads as inert text and still renders the page.
    await page.goto("/whale?q=' OR 1=1 --");

    await expect(page.locator('.browse-layout')).toBeVisible();
  });

  test('POST /auth/login without CSRF does not create a successful login flow', async ({ page }) => {
    // Intent: verify direct POST attempts without a form token are rejected or otherwise prevented from logging a user in.
    const response = await page.request.post('/auth/login', {
      form: {
        identifier: 'test@example.com',
        password: 'QATestWhale2026!',
      },
    });

    expect(response.status()).not.toBe(500);
    expect(response.headers()['location'] || '').not.toContain('/whale');
  });
});

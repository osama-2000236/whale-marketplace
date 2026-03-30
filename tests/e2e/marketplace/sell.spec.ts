import { expect, test } from '@playwright/test';
import { buildSellImageFile, registerTestUser, validationMessage } from '../helpers/auth.helper';

test.describe('Marketplace sell', () => {
  test('Unauthenticated -> redirects to /auth/login', async ({ page }) => {
    // Intent: verify the sell entry route is protected and preserves the next target.
    await page.goto('/whale/sell');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Fsell$/);
    await expect(page.locator('input[name="next"]')).toHaveValue('/whale/sell');
  });

  test('Logged in -> form accessible', async ({ page }) => {
    // Intent: verify a newly registered, sell-capable user can open the sell form.
    await registerTestUser(page);
    await page.goto('/whale/sell');

    await expect(page.locator('form[action^="/whale/sell"]')).toBeVisible();
  });

  test('Form has all required fields', async ({ page }) => {
    // Intent: verify the sell form exposes every required control for creating a listing.
    await registerTestUser(page);
    await page.goto('/whale/sell');

    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('input[name="price"]')).toBeVisible();
    await expect(page.locator('select[name="condition"]')).toBeVisible();
    await expect(page.locator('select[name="categoryId"]')).toBeVisible();
    await expect(page.locator('select[name="city"]')).toBeVisible();
    await expect(page.locator('input[name="images"]')).toBeVisible();
  });

  test('Empty form shows validation errors', async ({ page }) => {
    // Intent: verify the required sell controls enforce native validation when submitted empty.
    await registerTestUser(page);
    await page.goto('/whale/sell');
    await page.locator('form[action^="/whale/sell"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="title"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'textarea[name="description"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="price"]')).not.toBe('');
  });

  test('Valid submission succeeds', async ({ page }) => {
    // Intent: verify a logged-in user can create a listing end to end and land on the new detail page.
    await registerTestUser(page);
    await page.goto('/whale/sell');

    const category = await page.locator('select[name="categoryId"]').evaluate((select) => {
      const option = Array.from((select as HTMLSelectElement).options).find((entry) => entry.value);
      return option ? { value: option.value, label: option.textContent?.trim() || '' } : null;
    });
    if (!category) {
      throw new Error('Sell form did not render any category options');
    }

    const title = `QA sell listing ${Date.now()}`;
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="titleAr"]').fill('منتج بيع اختباري');
    await page.locator('textarea[name="description"]').fill('Automated QA listing created locally.');
    await page.locator('textarea[name="descriptionAr"]').fill('إعلان اختباري تم إنشاؤه تلقائياً.');
    await page.locator('input[name="price"]').fill('123');
    await page.locator('select[name="condition"]').selectOption('GOOD');
    await page.locator('select[name="categoryId"]').selectOption(category.value);
    await page.locator('select[name="city"]').selectOption('Gaza');
    await page.locator('input[name="images"]').setInputFiles(buildSellImageFile());
    await page.locator('input[name="tags"]').fill('qa,automation');

    await Promise.all([
      page.waitForURL(/\/whale\/listing\/[^/]+$/),
      page.locator('form[action^="/whale/sell"] button').click(),
    ]);

    await expect(page.locator('.listing-detail h1')).toContainText(title);
    await expect(page.locator('.listing-detail-category')).toContainText(category.label);
  });
});

import { Page, expect } from '@playwright/test';

/**
 * Helper: Log in as a specific user via the /auth/login form.
 * Uses the real selectors discovered from the live Brave inspection:
 *   - identifier field: input[name="identifier"]
 *   - password field:   input[name="password"]
 *   - submit button:    button[type="submit"]
 */
export async function loginAs(
  page: Page,
  identifier: string,
  password: string
): Promise<void> {
  await page.goto('/auth/login');
  await page.waitForSelector('input[name="identifier"]');
  await page.fill('input[name="identifier"]', identifier);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 10_000,
  });
}

/**
 * Helper: Register a unique test user.
 * Uses the real selectors from the live /auth/register page:
 *   - username:  input[name="username"]
 *   - email:     input[name="email"]
 *   - password:  input[name="password"]
 *   - submit:    button[type="submit"]
 */
export async function registerTestUser(page: Page): Promise<{
  username: string;
  email: string;
  password: string;
}> {
  const ts = Date.now();
  const username = `qa_${ts}`;
  const email = `qa-${ts}@whale-test.com`;
  const password = 'QATestWhale2026!';

  await page.goto('/auth/register');
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from register page
  await page.waitForURL((url) => !url.pathname.includes('/auth/register'), {
    timeout: 10_000,
  });

  return { username, email, password };
}

/**
 * Helper: Log out via POST /auth/logout form.
 */
export async function logout(page: Page): Promise<void> {
  // The logout is a POST form in the user menu dropdown
  await page.evaluate(() => {
    const form = document.querySelector(
      'form[action="/auth/logout"]'
    ) as HTMLFormElement;
    if (form) form.submit();
  });
  await page.waitForURL('/', { timeout: 10_000 });
}

/**
 * Demo credentials seeded in the database.
 */
export const DEMO_SELLER = {
  identifier: 'demo_seller',
  password: 'Demo1234!',
};

export const DEMO_BUYER = {
  identifier: 'demo_buyer',
  password: 'Demo1234!',
};

export const ADMIN = {
  identifier: 'admin',
  password: 'Admin1234!',
};

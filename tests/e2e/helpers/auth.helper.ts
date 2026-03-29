import { expect, type Browser, type Page } from '@playwright/test';

export type TestUser = {
  username: string;
  email: string;
  password: string;
};

const SELL_IMAGE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

export function buildSellImageFile() {
  return {
    name: 'sell-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(SELL_IMAGE_PNG_BASE64, 'base64'),
  };
}

export function buildTestUser(prefix = 'qa'): TestUser {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  return {
    username: `${prefix}_${stamp}`.slice(0, 30),
    email: `${prefix}-${stamp}@whale-test.com`,
    password: 'QATestWhale2026!',
  };
}

export async function registerTestUser(page: Page, user: Partial<TestUser> = {}): Promise<TestUser> {
  const credentials = { ...buildTestUser(), ...user };

  await page.goto('/auth/register');
  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('input[name="confirmPassword"]').fill(credentials.password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/auth/register'), {
      waitUntil: 'domcontentloaded',
    }),
    page.locator('form[action="/auth/register"] button').click(),
  ]);

  await expect(page).toHaveURL(/\/whale(?:\?.*)?$/);
  return credentials;
}

export async function createRegisteredUser(
  browser: Browser,
  user: Partial<TestUser> = {}
): Promise<TestUser> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    return await registerTestUser(page, user);
  } finally {
    await context.close();
  }
}

export async function loginAs(
  page: Page,
  identifier: string,
  password: string,
  next = '/whale'
): Promise<void> {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
  await page.locator('input[name="identifier"]').fill(identifier);
  await page.locator('input[name="password"]').fill(password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/auth/login'), {
      waitUntil: 'domcontentloaded',
    }),
    page.locator('form[action="/auth/login"] button').click(),
  ]);
}

export async function validationMessage(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((element) => {
    return (element as HTMLInputElement).validationMessage;
  });
}

export async function openUserMenu(page: Page): Promise<void> {
  const trigger = page.locator('.user-menu-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('.user-menu-dropdown')).toBeVisible();
}

export async function getCsrfToken(page: Page): Promise<string> {
  return page.locator('meta[name="csrf-token"]').getAttribute('content').then((value) => value || '');
}

export async function addCurrentListingToCart(page: Page, quantity = 1): Promise<string> {
  const checkoutHref = await page.locator('.listing-detail-actions a[href^="/whale/checkout/"]').first().getAttribute('href');
  if (!checkoutHref) {
    throw new Error('Missing checkout link for listing');
  }

  const listingId = checkoutHref.split('/').pop();
  if (!listingId) {
    throw new Error('Missing listing id in checkout link');
  }

  const csrfToken = await getCsrfToken(page);
  await Promise.all([
    page.waitForURL(/\/cart$/),
    page.evaluate(
      ({ csrf, itemListingId, itemQuantity }) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/cart/add';
        form.style.display = 'none';

        const fields = {
          _csrf: csrf,
          listingId: itemListingId,
          quantity: String(itemQuantity),
        };

        Object.entries(fields).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      },
      { csrf: csrfToken, itemListingId: listingId, itemQuantity: quantity },
    ),
  ]);

  return listingId;
}

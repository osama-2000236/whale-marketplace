function extractCsrf(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/i);
  return match ? match[1] : '';
}

async function ensureUserExists(page, username, password) {
  const registerPage = await page.request.get('/auth/register');
  const html = await registerPage.text();
  const csrfToken = extractCsrf(html);
  if (!csrfToken) return;

  await page.request.post('/auth/register', {
    form: {
      _csrf: csrfToken,
      username,
      email: `${username}@whale.ps`,
      password
    }
  }).catch(() => {});
}

/**
 * Login helper for auth-required UI tests.
 */
async function loginAs(page, username = 'uitest_pro', password = 'uitestpass') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch (err) {
      if (attempt === 3) throw err;
      continue;
    }

    const landedOnLoginPath = /\/auth\/login\b/.test(new URL(page.url()).pathname);
    if (!landedOnLoginPath) return;

    await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
    await page.fill('input[name="identifier"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const loginFormStillVisible = await page.locator('form[action="/auth/login"]').count();
    const onLoginPath = /\/auth\/login\b/.test(new URL(page.url()).pathname);
    if (!onLoginPath && loginFormStillVisible === 0) return;

    if (attempt === 1) {
      await ensureUserExists(page, username, password);
      continue;
    }
    if (attempt === 2) continue;
  }

  throw new Error(`loginAs failed for user ${username}`);
}

/**
 * Request-context helper if a suite wants to ensure the user exists.
 */
async function ensureProUser(request) {
  const registerPage = await request.get('/auth/register');
  const html = await registerPage.text();
  const csrfToken = extractCsrf(html);

  await request
    .post('/auth/register', {
      form: {
        _csrf: csrfToken,
        username: 'uitest_pro',
        email: 'uitest_pro@whale.ps',
        password: 'uitestpass'
      }
    })
    .catch(() => {});
}

module.exports = { loginAs, ensureProUser, extractCsrf };

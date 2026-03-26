/**
 * End-to-end test script for whale-marketplace
 * Tests all critical routes and flows
 */
const http = require('http');

const BASE = 'http://localhost:3001';
let cookies = {};
let passed = 0;
let failed = 0;
const errors = [];

function parseCookies(headers) {
  const setCookies = headers['set-cookie'] || [];
  for (const sc of Array.isArray(setCookies) ? setCookies : [setCookies]) {
    const parts = sc.split(';')[0].split('=');
    cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
}

function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function request(method, path, body, followRedirects = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Cookie: cookieHeader(),
      },
    };
    if (body) {
      const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(options, (res) => {
      parseCookies(res.headers);
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', async () => {
        const html = Buffer.concat(chunks).toString();
        if (
          followRedirects &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          try {
            const result = await request('GET', res.headers.location, null, true);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        } else {
          resolve({
            status: res.statusCode,
            html,
            headers: res.headers,
            location: res.headers.location,
          });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();
      req.write(data);
    }
    req.end();
  });
}

function extractCsrf(html) {
  const m = html.match(/name="_csrf" value="([^"]+)"/);
  return m ? m[1] : null;
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    errors.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

async function run() {
  console.log('=== WHALE MARKETPLACE E2E TESTS ===\n');

  // ─── PUBLIC ROUTES ──────────────────────────────────────
  console.log('1. Public Routes');
  const publicRoutes = [
    '/whale',
    '/auth/login',
    '/auth/register',
    '/forum',
    '/about',
    '/contact',
    '/safety',
    '/pricing',
    '/terms',
    '/privacy',
    '/buyer-protection',
    '/search',
    '/admin/login',
    '/upgrade',
    '/api/health',
  ];
  for (const route of publicRoutes) {
    const res = await request('GET', route);
    const hasTemplateError = /ReferenceError|TypeError|is not defined|Cannot read|ENOENT/.test(
      res.html
    );
    assert(
      res.status === 200 && !hasTemplateError,
      `GET ${route} → ${res.status}${hasTemplateError ? ' [TEMPLATE ERROR]' : ''}`
    );
    if (hasTemplateError) {
      const errMatch = res.html.match(/(ReferenceError|TypeError):[^\n<]+/);
      if (errMatch) console.log(`    ERROR: ${errMatch[0]}`);
    }
  }

  // ─── REGISTRATION ──────────────────────────────────────
  console.log('\n2. Registration');
  let res = await request('GET', '/auth/register');
  let csrf = extractCsrf(res.html);
  assert(!!csrf, 'Got CSRF token from register page');

  const username = 'e2etest' + Date.now();
  res = await request('POST', '/auth/register', {
    username,
    email: `${username}@test.com`,
    password: 'TestPass123',
    _csrf: csrf,
  });
  assert(res.status === 302, `Register → ${res.status} (should be 302)`);
  assert(res.location === '/whale', `Redirect to ${res.location}`);
  assert(!!cookies['whale.sid'], 'Session cookie set');

  // ─── AUTHENTICATED ROUTES ──────────────────────────────
  console.log('\n3. Authenticated Routes');
  const authRoutes = [
    '/whale',
    '/whale/sell',
    '/whale/orders',
    '/whale/my-listings',
    '/whale/dashboard',
    '/whale/saved',
    '/whale/cart',
    '/forum',
    '/notifications',
    '/upgrade',
    '/payment/history',
  ];
  for (const route of authRoutes) {
    res = await request('GET', route);
    const hasTemplateError = /ReferenceError|TypeError|is not defined|Cannot read|ENOENT/.test(
      res.html
    );
    assert(
      (res.status === 200 || res.status === 302) && !hasTemplateError,
      `GET ${route} → ${res.status}${hasTemplateError ? ' [TEMPLATE ERROR]' : ''}`
    );
    if (hasTemplateError) {
      const errMatch = res.html.match(/(ReferenceError|TypeError):[^\n<]+/);
      if (errMatch) console.log(`    ERROR: ${errMatch[0]}`);
    }
  }

  // ─── CREATE LISTING ────────────────────────────────────
  console.log('\n4. Create Listing');
  // Sell page requires Pro subscription and multipart form (images)
  // Just verify the sell page loads for Pro users or redirects for free users
  res = await request('GET', '/whale/sell');
  assert(
    res.status === 200 || res.status === 302,
    `GET /whale/sell → ${res.status} (200 for Pro, 302 for free)`
  );

  // ─── CART OPERATIONS ───────────────────────────────────
  console.log('\n5. Cart');
  res = await request('GET', '/whale/cart');
  assert(res.status === 200, `GET /whale/cart → ${res.status}`);

  // ─── FORUM ─────────────────────────────────────────────
  console.log('\n6. Forum');
  res = await request('GET', '/forum');
  assert(res.status === 200, `GET /forum → ${res.status}`);

  // Forum new thread requires a category slug (e.g. /forum/:slug/new)
  // Skip this test as it requires existing forum categories

  // ─── SEARCH ────────────────────────────────────────────
  console.log('\n7. Search');
  res = await request('GET', '/search?q=test');
  assert(res.status === 200, `GET /search?q=test → ${res.status}`);

  // No /api/search endpoint exists — search is via /search only

  // ─── LANGUAGE SWITCH ───────────────────────────────────
  console.log('\n8. Language & Theme');
  res = await request('GET', '/whale');
  csrf = extractCsrf(res.html);
  if (csrf) {
    res = await request('POST', '/prefs/lang', { lang: 'en', _csrf: csrf });
    assert(res.status === 302 || res.status === 200, `Switch to English → ${res.status}`);

    res = await request('GET', '/whale');
    csrf = extractCsrf(res.html);
    res = await request('POST', '/prefs/theme', { theme: 'dark', _csrf: csrf });
    assert(res.status === 302 || res.status === 200, `Switch to dark theme → ${res.status}`);
  }

  // ─── SITEMAP ───────────────────────────────────────────
  console.log('\n9. Sitemap & Robots');
  res = await request('GET', '/sitemap.xml');
  assert(res.status === 200 && res.html.includes('<?xml'), `GET /sitemap.xml → ${res.status}`);

  res = await request('GET', '/robots.txt');
  assert(res.status === 200 && res.html.includes('Sitemap'), `GET /robots.txt → ${res.status}`);

  // ─── API ENDPOINTS ─────────────────────────────────────
  console.log('\n10. API');
  res = await request('GET', '/api/health');
  assert(res.status === 200, `GET /api/health → ${res.status}`);

  res = await request('GET', '/api/config');
  assert(res.status === 200, `GET /api/config → ${res.status}`);

  // ─── 404 ───────────────────────────────────────────────
  console.log('\n11. Error Handling');
  res = await request('GET', '/nonexistent-page-xyz');
  assert(res.status === 404, `GET /nonexistent → ${res.status}`);

  // ─── ADMIN LOGIN ──────────────────────────────────────
  console.log('\n12. Admin');
  res = await request('GET', '/admin/login');
  assert(res.status === 200 || res.status === 302, `GET /admin/login → ${res.status}`);

  // ─── LOGOUT ────────────────────────────────────────────
  console.log('\n13. Logout');
  res = await request('GET', '/whale');
  csrf = extractCsrf(res.html);
  if (csrf) {
    res = await request('POST', '/auth/logout', { _csrf: csrf });
    assert(res.status === 302, `POST /auth/logout → ${res.status}`);
  }

  // Verify logged out
  res = await request('GET', '/whale/sell');
  assert(res.status === 302 || res.html.includes('login'), 'Sell page requires auth after logout');

  // ─── LOGIN ─────────────────────────────────────────────
  console.log('\n14. Login');
  res = await request('GET', '/auth/login');
  csrf = extractCsrf(res.html);
  res = await request('POST', '/auth/login', {
    identifier: username,
    password: 'TestPass123',
    _csrf: csrf,
  });
  assert(res.status === 302, `Login → ${res.status}`);
  assert(!!cookies['whale.sid'], 'Session restored after login');

  // ─── USER PROFILE ──────────────────────────────────────
  console.log('\n15. User Profile');
  res = await request('GET', `/u/${username}`);
  assert(res.status === 200, `GET /u/${username} → ${res.status}`);

  // ─── SUMMARY ───────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (errors.length) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test runner error:', e);
  process.exit(1);
});

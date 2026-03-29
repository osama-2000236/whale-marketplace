# QA Test Report — Whale Marketplace
**Date:** 2026-03-29
**Tester:** Codex (GPT-5.4)
**Target:** local app via Playwright `webServer` (`http://127.0.0.1:3001` during final validation)
**Branch:** current working branch

## Results Summary
| Layer | Total | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Playwright E2E matrix | 444 | 444 | 0 | 0 |
| Jest unit/integration | 193 | 193 | 0 | 0 |

Canonical E2E coverage is `74` TypeScript tests under `tests/e2e`, executed across six compatibility targets:
- `Desktop Chrome` — 74/74
- `Desktop Firefox` — 74/74
- `Desktop Safari` — 74/74
- `Mobile Chrome` — 74/74
- `Mobile Safari` — 74/74
- `Tablet` — 74/74

## Validation Run
```bash
npm run lint
npm test
PLAYWRIGHT_PORT=3001 npx playwright test
```

## Findings Addressed In This Pass
- Admin 2FA enforcement was restored for `/admin` access through `/auth/2fa` and the `admin2FAVerified` session contract.
- Admin scope middleware was restored to the route-facing scope-label API used by `routes/admin.js`.
- Auth flows now call the real security-service APIs: `sendVerificationEmail(user.id)` and `sendPasswordReset(email)`.
- Email verification now updates `emailVerified`, `isVerified`, and seller-profile verification state together.
- Playwright compatibility coverage was restored to the six-project baseline.
- Local WebKit compatibility was fixed by disabling CSP `upgrade-insecure-requests` for non-HTTPS local runs.
- Client click delegation was hardened in `public/js/app.js` so Safari/WebKit does not break on non-element event targets.

## Routes And Flows Covered
| Route / Flow | Method | Auth Required | Expected Result |
|--------------|--------|---------------|-----------------|
| `/` | `GET` | No | Homepage renders hero, categories, trust section, latest listings |
| `/whale` | `GET` | No | Browse grid renders with filters and cards |
| `/whale?category=<slug>` | `GET` | No | Category filters load without crashing |
| `/whale/listing/:slug` | `GET` | No | Listing detail renders title, price, category, seller info, gallery, CTA |
| `/whale/listing/fake-slug-does-not-exist` | `GET` | No | Returns `404` without crashing |
| `/whale/sell` | `GET` | Yes | Anonymous users redirect to `/auth/login?next=%2Fwhale%2Fsell` |
| `/whale/dashboard` | `GET` | Yes | Anonymous users redirect to login |
| `/whale/orders` | `GET` | Yes | Anonymous users redirect to login |
| `/auth/login` | `GET` | No | Login form renders |
| `/auth/login` | `POST` | No | Valid login succeeds, invalid login stays on form with flash error |
| `/auth/register` | `GET` | No | Register form renders |
| `/auth/register` | `POST` | No | Valid register succeeds, invalid register shows flash or native validation |
| `/auth/forgot-password` | `GET` / `POST` | No | Route contract covered in Jest regression tests |
| `/auth/resend-verification` | `POST` | Yes | Route contract covered in Jest regression tests |
| `/auth/2fa` | `GET` / `POST` | Admin | Admin 2FA route contract covered in Jest regression tests |
| `/auth/logout` | `POST` | Yes | Verified as the real route; this is not a `GET` route |
| `/admin` | `GET` | Admin + 2FA | Non-admins are blocked; admin 2FA enforced by regression tests |
| `/pages/about` | `GET` | No | Static page loads with content |
| `/pages/terms` | `GET` | No | Static page loads with content |
| `/pages/privacy` | `GET` | No | Static page loads with content |
| `/pages/safety` | `GET` | No | Static page loads with content |

## Selector Notes
All E2E selectors come from the current source, not the pasted JS patch.

- Login form: `form[action="/auth/login"]`, `input[name="identifier"]`, `input[name="password"]`
- Register form: `form[action="/auth/register"]`, `input[name="username"]`, `input[name="email"]`, `input[name="password"]`, `input[name="confirmPassword"]`
- Navbar: `.navbar-brand`, `.navbar-nav`, `.navbar-actions`, `.navbar-toggle`
- Theme toggle: `[data-theme-toggle]`, `.theme-toggle-icon`
- Locale toggle: `[data-locale]`
- Browse page: `.filter-sidebar`, `.filter-form`, `.grid-listings .listing-card`
- Sell form: `form[action^="/whale/sell"]`, `select[name="categoryId"]`, `select[name="city"]`, `input[name="images"]`
- Listing detail: `.listing-detail`, `.listing-detail-price`, `.listing-detail-category`, `.seller-info`, `.gallery`
- Footer pages: `footer`, `.prose`

## Compatibility Notes
- The compatibility matrix now matches the project baseline: Chrome, Firefox, Safari/WebKit, Android Chrome, iPhone Safari, and tablet.
- The local Safari/WebKit failures were caused by CSP upgrading local `http://127.0.0.1` asset and form requests to `https://127.0.0.1`, which produced real `SSL connect error` failures. This was fixed in app code by only enabling `upgrade-insecure-requests` for HTTPS production.
- The Safari UI failures for theme, locale, and mobile navigation were validated after the client-side event-target hardening in `public/js/app.js`.

## Open Bug Log
| # | File | Test | Severity | Expected | Actual |
|---|------|------|----------|----------|--------|
| None | - | - | - | - | No open failures remain in the final local validation run. |

## Recommendations
- Keep `tests/e2e/**/*.spec.ts` as the only canonical Playwright suite.
- Keep local localhost-first execution as the default and use `PLAYWRIGHT_BASE_URL` only when intentionally targeting a deployment.
- Preserve the six-project Playwright matrix; do not reduce it back to Chromium-only coverage.
- Retain the admin/auth regression tests because the previous breakages were not detectable from UI-only green runs.

## How To Run Locally
```bash
npm install
npx prisma generate
npx playwright install --with-deps chromium
npm test
npx playwright test
npx playwright show-report
```

# QA Consolidated Report

Date: 2026-03-26 (Asia/Hebron)
Workspace: C:\Users\osama\OneDrive\سطح المكتب\Whale_Store\.claude\worktrees\gracious-colden

## Final Status

- Zero-error target: NOT achieved.
- `npx jest --coverage` pass requirement (>=99% lines): NOT achieved because test failures remain.
- Current line coverage: 99.40% (`LH=167`, `LF=168`) from `coverage/lcov.info`.
- Current Jest totals: 9 suites, 95 tests, 8 failed, 87 passed.

## All Previous + Current Jest Suites

- FAIL | 15 passed | 8 failed | `__tests__/uiux.guideline.test.js`
- PASS | 23 passed | 0 failed | `__tests__/orderStateMachine.test.js`
- PASS | 17 passed | 0 failed | `__tests__/auth.middleware.test.js`
- PASS | 9 passed | 0 failed | `__tests__/emailService.test.js`
- PASS | 5 passed | 0 failed | `__tests__/i18n.test.js`
- PASS | 3 passed | 0 failed | `__tests__/locale.middleware.test.js`
- PASS | 7 passed | 0 failed | `__tests__/sanitize.test.js`
- PASS | 4 passed | 0 failed | `__tests__/subscription.middleware.test.js`
- PASS | 4 passed | 0 failed | `__tests__/pagination.test.js`

## Test Depth Raised (UI/UX)

- Added deep UI/UX guideline suite: `__tests__/uiux.guideline.test.js`.
- UI/UX checks in suite: 23 tests.
- Coverage areas expanded:
  - PR checklist policy validation
  - Responsive breakpoints
  - Accessibility semantics (`aria-*`, alt text)
  - RTL and dark mode CSS support
  - Mobile nav interaction behavior
  - Motion/accessibility preference checks (`prefers-reduced-motion`)
  - UX interaction checks (flash auto-dismiss, save state, confirm flows)

## Command Matrix (All QA Commands Run)

| Command                                          | Latest Result | Evidence                                                                                 | Related File/Line                                           | Simple Explanation                                                                                                  |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                         | FAIL          | `EPERM unlink ... node_modules/.prisma/client/query_engine-windows.dll.node`             | `node_modules/.prisma/client/query_engine-windows.dll.node` | Install blocked by locked Prisma engine binary (permission/file lock issue).                                        |
| `npm audit --audit-level=high`                   | FAIL          | `8 vulnerabilities (2 low, 6 high)`                                                      | `package.json:15-43`                                        | Dependency tree has high-severity advisories (`cookie`, `effect`, `nodemailer`, `tar`).                             |
| `npm ls --depth=0`                               | PASS          | Full top-level dependency tree resolves cleanly after install                            | `package.json:15-48`                                        | Dependency integrity is now consistent in current workspace state.                                                  |
| `node scripts/check-secrets.js`                  | FAIL          | `MODULE_NOT_FOUND`                                                                       | `.github/workflows/ci.yml:43`                               | CI references a secrets checker script that is missing from repo.                                                   |
| `npm run test:coverage`                          | FAIL          | Jest coverage run completes with failures: `1 failed suite, 8 failed tests, 99.4% lines` | `package.json:6-17`, `__tests__/uiux.guideline.test.js`     | Script exists now; failure source is UI/UX assertion mismatches, not missing script.                                |
| `npm run test:ui`                                | FAIL          | Strict runs: `131 failed/479 passed/2 flaky` and `481 failed/130 passed/1 flaky`         | `package.json:6-17`, `qa.uiux.spec.js`, `server.js:160`     | Script exists now; failures include app/UI assertions plus runtime instability (`Could not connect`, `EADDRINUSE`). |
| `npx prisma generate`                            | PASS          | Prisma Client generated successfully                                                     | `prisma/schema.prisma:1-8`                                  | Client generation works with current schema/env.                                                                    |
| `npx prisma migrate deploy`                      | PASS          | `No pending migrations to apply`                                                         | `prisma/migrations/`                                        | Migration deploy now works in current local DB context.                                                             |
| `npx prisma db pull`                             | PASS          | `Introspected 13 models`                                                                 | `prisma/schema.prisma:10-280`                               | DB introspection now works in current local DB context.                                                             |
| `npm run seed`                                   | PASS          | Seeder completes (`[seed] Done!`)                                                        | `prisma/seed.js`                                            | Seed flow now runs end-to-end successfully.                                                                         |
| `node server.js`                                 | PASS          | Startup log: `Whale running on port 3000`                                                | `server.js:160`                                             | Server boot now succeeds in current workspace state.                                                                |
| `npx playwright test --project="Desktop Chrome"` | FAIL          | `Project(s) "Desktop Chrome" not found`                                                  | `.github/workflows/ci.yml:144`                              | Workflow expects a Playwright project name that is not available locally.                                           |
| `npm test`                                       | FAIL          | Jest run fails on UI/UX assertions                                                       | `__tests__/uiux.guideline.test.js`                          | App currently violates multiple UI/UX guideline checks.                                                             |
| `npx jest --coverage`                            | FAIL          | 8 failed tests; coverage 99.40%                                                          | `__tests__/uiux.guideline.test.js`                          | Coverage threshold is met, but command still fails because tests fail.                                              |
| `npx jest --detectOpenHandles`                   | FAIL          | Same 8 failed tests                                                                      | `__tests__/uiux.guideline.test.js`                          | Failure is functional/UI-UX assertions, not only open handles.                                                      |

## UI/UX Deep Failures (File + Line + Explanation)

1. Missing explicit device breakpoints 320/375/428

- Failing test: `__tests__/uiux.guideline.test.js:62-66`
- File lines: `public/css/main.css:333`, `public/css/main.css:347`
- Explanation: CSS only defines `768px` and `480px` media blocks; no explicit checks for required checklist widths.
- Suggestion: Add dedicated responsive rules for 428px, 375px, 320px QA targets.

2. Touch target size below recommended minimum

- Failing test: `__tests__/uiux.guideline.test.js:68-71`
- File line: `public/css/main.css:94`
- Explanation: `.icon-btn` is `36x36`, below 44x44 touch minimum commonly used for accessibility/mobile UX.
- Suggestion: Raise interactive icon controls to at least 44x44.

3. Reduced-motion support missing

- Failing test: `__tests__/uiux.guideline.test.js:73-76`
- File lines: `public/css/main.css:327-330`
- Explanation: Animations exist, but no `@media (prefers-reduced-motion: reduce)` override is present.
- Suggestion: Add reduced-motion media query to disable/limit non-essential animation.

4. Mobile menu toggle missing semantic ARIA wiring

- Failing test: `__tests__/uiux.guideline.test.js:78-82`
- File lines: `views/partials/navbar.ejs:5`, `views/partials/navbar.ejs:7`
- Explanation: Toggle has `aria-label` only; missing `aria-controls` and `aria-expanded`, and target nav id linkage.
- Suggestion: Bind toggle button and nav panel with `aria-controls` + dynamic `aria-expanded`.

5. Missing aria-labels on icon-like controls

- Failing test: `__tests__/uiux.guideline.test.js:84-89`
- File lines: `views/partials/navbar.ejs:22`, `views/partials/navbar.ejs:27`, `views/partials/navbar.ejs:29`, `views/partials/navbar.ejs:41`
- Explanation: Theme, locale, and user menu trigger controls rely on title/text but not explicit assistive labels.
- Suggestion: Add localized `aria-label` attributes to all icon/compact controls.

6. User menu trigger missing popup semantics

- Failing test: `__tests__/uiux.guideline.test.js:91-94`
- File line: `views/partials/navbar.ejs:41`
- Explanation: Trigger lacks `aria-haspopup` and state (`aria-expanded`) for dropdown semantics.
- Suggestion: Add popup semantics and synchronize state with open/close behavior.

7. Avatar image alt text is empty

- Failing test: `__tests__/uiux.guideline.test.js:96-99`
- File line: `views/partials/navbar.ejs:44`
- Explanation: `<img ... alt="">` provides no user context for profile/avatar image.
- Suggestion: Provide meaningful alt text (or intentional decorative handling if truly decorative).

8. JS toggle does not update ARIA expanded state

- Failing test: `__tests__/uiux.guideline.test.js:111-114`
- File lines: `public/js/app.js:95-100`
- Explanation: Script toggles `.open` class only; it does not keep accessibility state (`aria-expanded`) in sync.
- Suggestion: Update ARIA state in JS whenever mobile menu opens/closes.

## Previous vs Current Run Delta

- Previously in this thread, Prisma DB commands reported failures in one run.
- Current rerun (2026-03-26) shows:
  - `npx prisma migrate deploy`: PASS
  - `npx prisma db pull`: PASS
- Main blockers remain dependency integrity, missing QA support files (for example `scripts/check-secrets.js`), and UI/UX guideline assertion failures.

## Suggested Non-Code Action Order (Report-Only)

1. Dependency health first (`npm ci`, `npm ls`, missing modules) to stabilize runtime.
2. CI/script alignment (`test:coverage`, `test:ui`, `check-secrets.js`) so pipeline checks are executable.
3. UI/UX accessibility/semantics failures (8 listed above) to make `npm test` and `npx jest --coverage` pass.
4. Playwright project configuration alignment with CI project name (`Desktop Chrome`).

## Additional QA Evidence (Extended Data)

- Evidence files generated:
  - `.qa-audit.json` (npm audit machine-readable output)
  - `.qa-npm-ls.txt` (dependency tree health output)
  - `.qa-jest-output.txt` (full Jest output from latest run)
  - `.uiux-jest.json` (Jest structured results)

## Dependency Integrity Breakdown (Detailed)

- Missing dependencies (20):
  - `@prisma/client@^6.0.0`
  - `@sendgrid/mail@^8.1.0`
  - `cloudinary@^2.0.0`
  - `connect-pg-simple@^9.0.0`
  - `csurf@^1.11.0`
  - `dotenv@^16.4.0`
  - `ejs@^3.1.10`
  - `express-rate-limit@^7.2.0`
  - `express-session@^1.18.0`
  - `express@^4.21.0`
  - `helmet@^7.1.0`
  - `jest@^29.7.0`
  - `marked@^12.0.0`
  - `multer@^1.4.5-lts.1`
  - `nodemailer@^6.9.0`
  - `passport-google-oauth20@^2.0.0`
  - `passport-local@^1.0.0`
  - `passport@^0.7.0`
  - `slugify@^1.6.6`
  - `supertest@^7.0.0`
- Invalid dependencies (5): `@anthropic-ai/sdk`, `bcrypt`, `pino-pretty`, `pino`, `prisma`
- Extraneous dependencies (19): `@babel/core`, `@babel/helper-compilation-targets`, `@babel/traverse`, `@babel/types`, `@bcoe/v8-coverage`, `@mapbox/node-pre-gyp`, `@prisma/engines`, `are-we-there-yet`, `axios`, `effect`, `fast-check`, `formdata-node`, `http-errors`, `istanbul-reports`, `js-yaml`, `nypm`, `pino-abstract-transport`, `pure-rand`, `resolve`
- Source evidence: `.qa-npm-ls.txt`

## Vulnerability Breakdown (Detailed)

- Source evidence: `.qa-audit.json`
- Totals from audit metadata:
  - Low: 2
  - High: 6
  - Moderate: 0
  - Critical: 0
- Vulnerable packages reported:
  - `@mapbox/node-pre-gyp` (high) via `tar`
  - `@prisma/config` (high) via `effect`
  - `cookie` (low)
  - `csurf` (low) via `cookie`
  - `effect` (high)
  - `nodemailer` (high)
  - `prisma` (high) via `@prisma/config`
  - `tar` (high)
- Simple explanation: security risk surface is concentrated in transitive packages tied to Prisma tooling, tar extraction chain, and email stack.

## Extended UI/UX Static Scan (Project-Wide)

- Scan scope: 29 EJS files in `views/`
- Files with `<img>` missing alt attribute (10):
  - `views/partials/listing-card.ejs:4`
  - `views/partials/navbar.ejs:44`
  - `views/profile/index.ejs:16`
  - `views/whale/checkout.ejs:57`
  - `views/whale/listing.ejs:11`
  - `views/whale/listing.ejs:17`
  - `views/whale/listing.ejs:66`
  - `views/whale/order.ejs:22`
  - `views/whale/orders.ejs:39`
  - `views/whale/seller.ejs:10`
- Files with empty alt text (2):
  - `views/auth/login.ejs:12`
  - `views/auth/register.ejs:12`
- Potential icon-like buttons without accessible name (24 candidates):
  - `views/admin/listings.ejs:28`
  - `views/admin/orders.ejs:42`
  - `views/admin/users.ejs:9`
  - `views/admin/users.ejs:35`
  - `views/auth/login.ejs:29`
  - `views/auth/register.ejs:32`
  - `views/partials/navbar.ejs:60`
  - `views/payment/upgrade.ejs:24`
  - `views/payment/upgrade.ejs:29`
  - `views/profile/index.ejs:45`
  - `views/whale/checkout.ejs:46`
  - `views/whale/edit.ejs:83`
  - `views/whale/index.ejs:65`
  - `views/whale/listing.ejs:55`
  - `views/whale/order.ejs:73`
  - `views/whale/order.ejs:100`
  - `views/whale/order.ejs:112`
  - `views/whale/order.ejs:119`
  - `views/whale/order.ejs:134`
  - `views/whale/order.ejs:138`
  - `views/whale/order.ejs:145`
  - `views/whale/order.ejs:160`
  - `views/whale/order.ejs:165`
  - `views/whale/sell.ejs:85`
- Simple explanation: beyond the 8 enforced failing tests, broad static scan indicates additional accessibility gaps that can later become test failures if standards are enforced.

## CSS/JS Accessibility Gap Snapshot

- `public/css/main.css`
  - Missing: `.icon-btn:focus-visible`
  - Missing: `.nav-link:focus-visible`
  - Missing: `.user-menu-trigger:focus-visible`
  - Missing: `.navbar-toggle:focus-visible`
  - Missing: `@media (prefers-reduced-motion: reduce)`
  - Current media queries only: `max-width: 768px`, `max-width: 480px`
- `public/js/app.js`
  - Missing keyboard listeners (`keydown`)
  - Missing `Escape` handling for menu dismissal
  - Missing `aria-expanded` state writes
- Simple explanation: keyboard and focus-state affordances are incomplete for robust accessibility behavior.

## files.zip Strict Execution (Applied + Executed)

### Files applied from zip

- `README.md`
- `playwright.config.js`
- `qa.uiux.spec.js`

### Runtime preparation applied

- Added scripts in `package.json`:
  - `test:coverage`
  - `test:ui`
  - `test:ui:html`
- Added dev dependency entry in `package.json`:
  - `@playwright/test`

### Compatibility corrections needed to execute zip suite

- `qa.uiux.spec.js` had TypeScript-only syntax in a `.js` file.
- Corrected parser blockers at:
  - `qa.uiux.spec.js:433` (`window as any` -> `window`)
  - `qa.uiux.spec.js:829`, `qa.uiux.spec.js:835` (`performance as any` -> `performance`)
  - `qa.uiux.spec.js:674` (`lang!.length` -> `lang.length`)
  - `qa.uiux.spec.js:1159` (`request.get(url!)` -> `request.get(url)`)
  - `qa.uiux.spec.js:812`, `qa.uiux.spec.js:1033`, `qa.uiux.spec.js:1067`, `qa.uiux.spec.js:1125`, `qa.uiux.spec.js:1212` (removed TS `: string[]` annotations)
  - `qa.uiux.spec.js:1215`, `qa.uiux.spec.js:1217`, `qa.uiux.spec.js:1292` (removed TS param type annotations)

### Strict run commands and outcomes

1. Run without controlled server process:

- Command: `CI=true BASE_URL=http://localhost:3000 npm run test:ui`
- Artifact: `.qa-uiux-playwright.txt`
- Result: FAIL (`479 passed`, `131 failed`, `2 flaky`, `~20.2m`)
- Dominant issue: intermittent `Could not connect to server` from `qa.uiux.spec.js:47`

2. Run with server-orchestration attempt:

- Command launched server + `npm run test:ui` in one runner
- Artifacts:
  - `.qa-uiux-playwright-with-server.txt`
  - `.qa-server-runtime.txt`
- Result: FAIL (`130 passed`, `481 failed`, `1 flaky`, `~52.4m`)
- Runtime blocker: server bind conflict `EADDRINUSE` on port `3000` (`server.js:160`), so test run targeted an already-running process on that port.

### Dominant failure classes (across strict runs)

1. Environment/runtime instability:

- `Could not connect to server` events from `qa.uiux.spec.js:47`
- `EADDRINUSE` port conflict while starting app for controlled run (`server.js:160`)

2. Repeated semantic/content failures across projects:

- Missing skip link checks:
  - `qa.uiux.spec.js:440` (4.6 Skip-to-main-content)
- Missing meta/SEO requirements:
  - `qa.uiux.spec.js:1110` (meta description)
  - `qa.uiux.spec.js:1116` (Open Graph tags)
  - `qa.uiux.spec.js:1152` (favicon availability)
- Accessibility/interaction checks:
  - `qa.uiux.spec.js:625` (keyboard-only navigation)
  - `qa.uiux.spec.js:636` (focus ring visible)
  - `qa.uiux.spec.js:670` (`<html lang>` quality)
  - `qa.uiux.spec.js:861` (`cursor:pointer` checks)
- Layout semantic checks:
  - `qa.uiux.spec.js:138` (header visibility)
  - `qa.uiux.spec.js:146` (footer visibility)
  - `qa.uiux.spec.js:152` (main content spacing)

## Post-Install Delta (Current State)

- Executed: `npm install -D @playwright/test`
- Current `npm ls --depth=0`: PASS (clean top-level dependency tree)
- Current `npm run seed`: PASS
- Current `node server.js`: PASS (startup confirmed)
- Note: earlier dependency-missing findings in this report remain valid as historical evidence from the pre-install QA snapshot.

## Why Tests Failed (Root Causes)

### A) Why `npm run test:coverage` failed

- Command completed, but 8 assertions fail in `__tests__/uiux.guideline.test.js`.
- Root causes in app files:
  - Missing explicit breakpoints `320/375/428`: `public/css/main.css:333`, `public/css/main.css:347`
  - Touch target below 44x44 (`.icon-btn` is 36x36): `public/css/main.css:94`
  - Missing reduced-motion support: no `@media (prefers-reduced-motion: reduce)` near animations (`public/css/main.css:327-330`)
  - Missing navbar ARIA semantics/labels: `views/partials/navbar.ejs:22`, `:27`, `:29`, `:41`
  - Empty avatar alt text: `views/partials/navbar.ejs:44`
  - JS does not sync `aria-expanded` on mobile nav toggle: `public/js/app.js:95-100`

### B) Why `npm run test:ui` failed

- Full Playwright suite executed, but fails for two main reasons:

1. Runtime/environment instability during strict matrix

- `Could not connect to server` from `qa.uiux.spec.js:47` (`goto()` to `http://localhost:3000`)
- In orchestrated run, server startup hit port conflict:
  - `EADDRINUSE` at `server.js:160`
- Effect: many tests fail as downstream navigation failures even when test logic itself is valid.

2. Real UI/UX requirement gaps detected by strict suite

- Repeated failing requirement groups:
  - Skip link missing: `qa.uiux.spec.js:440`
  - Meta description missing/empty: `qa.uiux.spec.js:1110`
  - Open Graph tags missing/incomplete: `qa.uiux.spec.js:1116`
  - Favicon requirement fails: `qa.uiux.spec.js:1152`
  - Keyboard navigation/focus visibility issues: `qa.uiux.spec.js:625`, `:636`
  - `<html lang>` quality/assertion fails in some projects: `qa.uiux.spec.js:670`
  - Pointer affordance check fails: `qa.uiux.spec.js:861`
  - Long-text overflow check fails in some projects: `qa.uiux.spec.js:1259`
- Additional observed error source:
  - Console SSL resource errors triggered failure in error-state test:
    - `qa.uiux.spec.js:1066` (`Console has no critical JavaScript errors on load`)
    - Evidence in `.qa-uiux-playwright-with-server.txt`: `Failed to load resource: SSL connect error`

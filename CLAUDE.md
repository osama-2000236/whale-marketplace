# Whale Marketplace v2.0 (Reality Snapshot)

This file documents the current v2.0 architecture and stack so AI prompts and PR context stay aligned with the live codebase.

## Core Stack

- Runtime: Node.js 20 LTS
- Framework: Express + EJS server-rendered views
- Database: PostgreSQL + Prisma ORM
- Auth:
  - Local username/email + password
  - Google OAuth
  - Facebook OAuth
  - Apple Sign In
- Security:
  - `helmet` hardening
  - `csrf-sync` token protection for forms and `fetch` (`_csrf` / `x-csrf-token`)
  - `express-rate-limit` for auth and global protection
- Payments:
  - Stripe Checkout (card)
  - Paymob (iframe/token flow)
  - PayPal Checkout

## Dependency Baseline for v2

- `csrf-sync`
- `stripe`
- `bcrypt@6`
- `nodemailer@8`
- `passport-facebook`
- `passport-apple`

## App Structure

- `server.js`: app wiring (session, auth, locale, CSRF, routes, errors)
- `routes/`: feature routes (`auth`, `whale`, `payment`, `notifications`, `admin`, etc.)
- `services/`: business logic (`whaleService`, `userService`, `paymentService`, `emailService`)
- `views/`: EJS templates + shared partials
- `public/`: CSS/JS/static assets
- `prisma/`: schema, migrations, seed

## Business Flows

- Checkout flow:
  - `GET /whale/checkout/:id` (auth required)
  - `POST /whale/checkout/:id` creates order + notifications
- Upgrade flow:
  - `GET /upgrade` (auth required)
  - `POST /upgrade/paymob|stripe|paypal`
- OAuth flow:
  - `/auth/google`
  - `/auth/facebook`
  - `/auth/apple` (+ POST callback for Apple)
- Notifications flow:
  - `GET /notifications` (auth required, marks unread notifications as read)

## Testing

- Unit/integration: Jest (`__tests__/**/*.test.js`)
- UI flows and regression: Playwright (`*.spec.js`)
- Current baseline: 14 Jest suites, 123+ tests passing
- Linting/format:
  - `npm run lint`
  - `npm run format`

## Notes

- `.ejs` templates are intentionally excluded from automated Prettier runs due parser limitations with embedded EJS syntax patterns.
- Keep route/controller logic thin and put business rules in services.

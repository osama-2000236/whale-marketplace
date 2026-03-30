# Whale Marketplace

Whale (`الحوت`) is a trust-first peer-to-peer marketplace built for Palestine and Arab cities. The app is a server-rendered Express application with EJS views, Prisma/Postgres persistence, Passport-based auth, and Playwright/Jest coverage.

## Stack

- Node.js 20+
- Express + EJS
- Prisma + PostgreSQL
- Passport local/OAuth auth
- Jest for unit/integration tests
- Playwright for end-to-end browser tests

## Getting Started

1. Install dependencies:

```bash
npm ci
```

2. Copy the environment template and fill in the values you need:

```bash
cp .env.example .env
```

3. Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:deploy
```

4. Optionally seed local data:

```bash
npm run seed
```

5. Start the app:

```bash
npm run dev
```

Production boot uses:

```bash
npm start
```

`npm start` runs `entrypoint.js`, which applies Prisma migrations before starting the server. If migrations fail, startup exits with a non-zero status and does not try to reset the schema.

## Environment Notes

Use [`./.env.example`](./.env.example) as the source of truth for required variables.

Important groups:

- Core app: `NODE_ENV`, `PORT`, `BASE_URL`, `SESSION_SECRET`
- Database: `DATABASE_URL`
- Auth providers: Google, Facebook, Apple
- Payments: Stripe, Paymob, PayPal
- Media/email: Cloudinary, SendGrid, SMTP

When `DATABASE_URL` is missing, the marketplace can still render fallback browse content for local resilience checks, but checkout and account flows are intended to run against Postgres.

## Useful Commands

```bash
# App
npm run dev
npm start

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run seed

# Checks
npm run lint
npm test -- --runInBand

# Playwright
npx playwright test --project=chromium
npx playwright test --project=mobile-chrome
npx playwright test --list --project=chromium
```

## Testing

Jest covers service logic, middleware, routes, and configuration checks:

```bash
npm test -- --runInBand
```

Playwright runs against the server defined in [`./playwright.config.js`](./playwright.config.js). Supported project ids are:

- `chromium`
- `firefox`
- `webkit`
- `mobile-chrome`
- `mobile-safari`
- `tablet`

Example:

```bash
npx playwright test --project=chromium
```

## Deployment

- Railway/production entry uses `npm start`
- Migrations are applied at boot with `prisma migrate deploy`
- Seed execution is optional via `BOOT_SEED=1`
- Failed migrations abort startup instead of attempting destructive recovery

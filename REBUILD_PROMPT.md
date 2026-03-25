# WHALE MARKETPLACE — COMPLETE REBUILD PROMPT

> **HOW TO USE:** Paste this entire file into a fresh Claude Code session (or any capable AI coding assistant). The AI should produce a fully coded, deployable project with no follow-up questions needed. Every section below is an instruction, not a description.

---

## MISSION

Build **Whale (الحوت)** — a trust-first peer-to-peer marketplace for Palestine and Arab cities. The core promise: buyer money is held in escrow until delivery is confirmed. Every architectural decision should serve that promise.

**Requirements:**
- Bilingual: Arabic (default, RTL) + English
- Dark / light theme toggle, persisted in `localStorage`
- The marketplace lives at `/whale`; all legacy paths (`/marketplace`, `/market`, `/rooms`) redirect there
- Deployable to Railway via Docker with zero manual steps after `git push`

---

## TECHNOLOGY STACK (locked — do not substitute)

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 | Current LTS |
| Web | Express.js 4 | Proven, minimal |
| Templates | EJS | Server-rendered, no build step |
| ORM | Prisma 6 + PostgreSQL | Type-safe, clean migrations |
| Auth | Passport local + Google only | Drop Facebook/Apple complexity |
| Sessions | express-session | Cookie-based, httpOnly |
| Security | Helmet + csurf + express-rate-limit | Defense in depth |
| Upload | Multer + Cloudinary (local fallback) | Optional CDN |
| Email | SendGrid → Nodemailer SMTP | Dual fallback |
| AI | Anthropic SDK | Optional Claude listing assistant |
| Tests | Jest + Supertest | Unit + integration |
| Deploy | Docker (node:20-alpine) + Railway | Current target |

**Package versions to use:**
```json
{
  "express": "^4.19.0",
  "ejs": "^3.1.9",
  "@prisma/client": "^6.0.0",
  "prisma": "^6.0.0",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-google-oauth20": "^2.0.0",
  "express-session": "^1.18.0",
  "connect-pg-simple": "^9.0.0",
  "helmet": "^7.1.0",
  "csurf": "^1.11.0",
  "express-rate-limit": "^7.2.0",
  "bcrypt": "^5.1.1",
  "multer": "^1.4.5-lts.1",
  "cloudinary": "^2.0.0",
  "@sendgrid/mail": "^8.1.0",
  "nodemailer": "^6.9.0",
  "@anthropic-ai/sdk": "^0.24.0",
  "slugify": "^1.6.6",
  "marked": "^12.0.0",
  "dotenv": "^16.4.0",
  "jest": "^29.7.0",
  "supertest": "^7.0.0"
}
```

---

## SECURITY RULES (bake into every generated file — no exceptions)

1. **Helmet** with a tight CSP: `default-src 'self'`, allow `style-src 'self' 'unsafe-inline' fonts.googleapis.com`, allow `font-src fonts.gstatic.com`, `img-src 'self' data: res.cloudinary.com`, `script-src 'self'`.
2. **CSRF**: Use `csurf` cookie strategy. Pass `csrfToken()` to every EJS render. All `POST`/`PATCH`/`DELETE` forms include `<input type="hidden" name="_csrf" value="<%= csrfToken %>">`. Webhook routes (`/webhooks/*`) must be explicitly excluded from CSRF middleware.
3. **Rate limits**: Global 300 req/15 min; auth write routes (`POST /auth/*`) 20 req/15 min; API routes 100 req/15 min.
4. **Passwords**: `bcrypt` with 12 rounds. Never MD5/SHA1 for passwords.
5. **Input sanitization**: Every `req.body` field passes through `utils/sanitize.js` before any service call. Strip HTML tags from all text fields. Truncate fields to their DB column max length.
6. **EJS output**: Never use `<%-` for user-supplied content — always `<%=`. The only exception is pre-sanitized, server-controlled markdown rendered through `marked`.
7. **Sessions**: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'strict'`, `maxAge: 7 * 24 * 60 * 60 * 1000`.
8. **Secrets**: All credentials in `.env` only. No hardcoded secrets anywhere.
9. **Prisma**: Parameterised queries everywhere. No `$queryRaw` with string interpolation.
10. **Auth guards** (implement as middleware in `middleware/auth.js`):
    - `optionalAuth` — attach `res.locals.user` if session exists, never throw
    - `requireAuth` — redirect to `/auth/login?next=<url>` if unauthenticated
    - `requireAdmin` — 403 if not `ADMIN` role
    - `requireOwner(model)` — 403 if `req.user.id !== resource.ownerId` and not admin

---

## PRISMA SCHEMA

Create `prisma/schema.prisma` with exactly these 11 models and the enums below. No extra models.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  MEMBER
}

enum ListingCondition {
  NEW
  LIKE_NEW
  GOOD
  USED
  FAIR
  FOR_PARTS
}

enum ListingStatus {
  DRAFT
  ACTIVE
  SOLD
  REMOVED
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
  DISPUTED
}

enum NotificationType {
  ORDER
  REVIEW
  SYSTEM
  FOLLOW
}

enum PaymentProvider {
  PAYMOB
  PAYPAL
  MANUAL
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model User {
  id            String        @id @default(cuid())
  username      String        @unique
  slug          String        @unique
  email         String        @unique
  passwordHash  String?
  googleId      String?       @unique
  role          UserRole      @default(MEMBER)
  avatar        String?
  avatarUrl     String?
  bio           String?
  isVerified    Boolean       @default(false)
  isBanned      Boolean       @default(false)
  createdAt     DateTime      @default(now())
  lastSeenAt    DateTime      @default(now())

  subscription  Subscription?
  sellerProfile SellerProfile?
  listings      Listing[]
  buyerOrders   Order[]       @relation("BuyerOrders")
  sellerOrders  Order[]       @relation("SellerOrders")
  reviews       Review[]      @relation("ReviewerReviews")
  savedListings SavedListing[]
  notifications Notification[]
  payments      Payment[]
  orderEvents   OrderEvent[]
}

model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan        String    @default("free")
  trialEndsAt DateTime?
  paidUntil   DateTime?
  autoRenew   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model SellerProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName  String
  bio          String?
  bioAr        String?
  city         String?
  whatsapp     String?
  totalSales   Int      @default(0)
  totalRevenue Decimal  @default(0) @db.Decimal(12, 2)
  avgRating    Float    @default(0)
  reviewCount  Int      @default(0)
  isVerified   Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Category {
  id            String        @id @default(cuid())
  name          String
  nameAr        String
  slug          String        @unique
  icon          String?
  order         Int           @default(0)
  subcategories Subcategory[]
  listings      Listing[]
}

model Subcategory {
  id         String    @id @default(cuid())
  name       String
  nameAr     String
  slug       String    @unique
  categoryId String
  category   Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  order      Int       @default(0)
  listings   Listing[]
}

model Listing {
  id             String           @id @default(cuid())
  slug           String           @unique
  title          String
  titleAr        String?
  description    String
  descriptionAr  String?
  price          Decimal          @db.Decimal(12, 2)
  negotiable     Boolean          @default(false)
  condition      ListingCondition @default(USED)
  images         String[]
  categoryId     String
  category       Category         @relation(fields: [categoryId], references: [id])
  subcategoryId  String?
  subcategory    Subcategory?     @relation(fields: [subcategoryId], references: [id])
  city           String
  sellerId       String
  seller         User             @relation(fields: [sellerId], references: [id])
  status         ListingStatus    @default(DRAFT)
  views          Int              @default(0)
  waClicks       Int              @default(0)
  isBoosted      Boolean          @default(false)
  boostExpiresAt DateTime?
  tags           String[]
  specs          Json?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  orders         Order[]
  savedBy        SavedListing[]
  reviews        Review[]
}

model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique @default(cuid())
  listingId       String
  listing         Listing     @relation(fields: [listingId], references: [id])
  buyerId         String
  buyer           User        @relation("BuyerOrders", fields: [buyerId], references: [id])
  sellerId        String
  seller          User        @relation("SellerOrders", fields: [sellerId], references: [id])
  quantity        Int         @default(1)
  amount          Decimal     @db.Decimal(12, 2)
  paymentMethod   String
  paymentStatus   String      @default("pending")
  status          OrderStatus @default(PENDING)
  shippingMethod  String?
  shippingAddress Json?
  trackingNumber  String?
  shippingCompany String?
  buyerNote       String?
  sellerNote      String?
  cancelReason    String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  events          OrderEvent[]
  review          Review?
}

model OrderEvent {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  event     String
  note      String?
  actorId   String?
  actor     User?    @relation(fields: [actorId], references: [id])
  createdAt DateTime @default(now())
}

model Review {
  id         String   @id @default(cuid())
  orderId    String   @unique
  order      Order    @relation(fields: [orderId], references: [id])
  listingId  String
  listing    Listing  @relation(fields: [listingId], references: [id])
  reviewerId String
  reviewer   User     @relation("ReviewerReviews", fields: [reviewerId], references: [id])
  sellerId   String
  rating     Int
  body       String?
  createdAt  DateTime @default(now())
}

model SavedListing {
  userId    String
  listingId String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  savedAt   DateTime @default(now())

  @@id([userId, listingId])
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  body      String?
  link      String?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())
}

model Payment {
  id                String          @id @default(cuid())
  userId            String
  user              User            @relation(fields: [userId], references: [id])
  provider          PaymentProvider
  providerPaymentId String?
  amount            Decimal         @db.Decimal(12, 2)
  currency          String          @default("USD")
  status            PaymentStatus   @default(PENDING)
  planMonths        Int             @default(1)
  metadata          Json?
  createdAt         DateTime        @default(now())
}
```

---

## FOLDER STRUCTURE

Scaffold exactly this structure. Create every file listed.

```
whale/
├── __tests__/
│   └── orderStateMachine.test.js
├── lib/
│   ├── prisma.js
│   ├── passport.js
│   ├── i18n.js
│   └── mailer.js
├── middleware/
│   ├── auth.js
│   ├── locale.js
│   └── subscription.js
├── prisma/
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/         (generated by prisma migrate dev)
├── public/
│   ├── css/
│   │   └── main.css
│   └── js/
│       └── app.js
├── routes/
│   ├── index.js
│   ├── auth.js
│   ├── whale.js
│   ├── profile.js
│   ├── payment.js
│   ├── webhooks.js
│   └── admin.js
├── services/
│   ├── whaleService.js
│   ├── userService.js
│   ├── emailService.js
│   └── paymentService.js
├── utils/
│   ├── sanitize.js
│   ├── images.js
│   └── pagination.js
├── views/
│   ├── partials/
│   │   ├── head.ejs
│   │   ├── navbar.ejs
│   │   ├── footer.ejs
│   │   ├── flash.ejs
│   │   ├── listing-card.ejs
│   │   └── order-status.ejs
│   ├── whale/
│   │   ├── index.ejs
│   │   ├── listing.ejs
│   │   ├── sell.ejs
│   │   ├── edit.ejs
│   │   ├── checkout.ejs
│   │   ├── orders.ejs
│   │   ├── order.ejs
│   │   ├── dashboard.ejs
│   │   ├── saved.ejs
│   │   └── seller.ejs
│   ├── auth/
│   │   ├── login.ejs
│   │   └── register.ejs
│   ├── profile/
│   │   └── index.ejs
│   ├── payment/
│   │   ├── upgrade.ejs
│   │   └── success.ejs
│   ├── pages/
│   │   ├── home.ejs
│   │   └── static.ejs
│   ├── admin/
│   │   ├── dashboard.ejs
│   │   ├── users.ejs
│   │   ├── listings.ejs
│   │   └── orders.ejs
│   ├── 404.ejs
│   └── error.ejs
├── .env.example
├── .gitignore
├── Dockerfile
├── entrypoint.js
├── package.json
├── railway.toml
└── server.js
```

---

## COMPLETE ROUTE MAP

Implement every route. Routes are thin — dispatch to services, render or redirect, nothing else.

```
# ── PUBLIC ──────────────────────────────────────────────────────────────
GET  /                           → render pages/home.ejs with recent listings + categories
GET  /whale                      → browse (q, category, city, condition, minPrice, maxPrice, sort, cursor)
GET  /whale/listing/:slug        → listing detail
GET  /whale/seller/:username     → public seller profile
GET  /search                     → redirect to /whale?q=<query>
GET  /health                     → 200 { status: 'ok', uptime }
GET  /pages/:slug                → static page (about, terms, privacy, safety) from markdown strings

# ── REDIRECTS ────────────────────────────────────────────────────────────
GET  /marketplace                → 301 /whale
GET  /market                     → 301 /whale
GET  /rooms                      → 301 /whale

# ── AUTH ─────────────────────────────────────────────────────────────────
GET  /auth/login                 → login form
POST /auth/login                 (rate: 20/15min) → passport.authenticate local
GET  /auth/register              → register form
POST /auth/register              (rate: 20/15min) → userService.register → auto-login → redirect /whale
GET  /auth/google                → passport.authenticate google
GET  /auth/google/callback       → OAuth callback → redirect /whale
POST /auth/logout                → session destroy → redirect /

# ── AUTHENTICATED ────────────────────────────────────────────────────────
POST /whale/listing/:id/save     (requireAuth) → whaleService.toggleSaved
GET  /whale/sell                 (requireAuth + requirePro) → sell form
POST /whale/sell                 (requireAuth + requirePro) → upload 6 images → whaleService.createListing
GET  /whale/listing/:id/edit     (requireAuth + requireOwner) → edit form
POST /whale/listing/:id/edit     (requireAuth + requireOwner) → whaleService.updateListing
POST /whale/listing/:id/delete   (requireAuth + requireOwner | requireAdmin) → whaleService.deleteListing
GET  /whale/checkout/:id         (requireAuth) → checkout form
POST /whale/checkout/:id         (requireAuth) → whaleService.createOrder → redirect /whale/orders/:id
GET  /whale/orders               (requireAuth) → order list (tab: buying|selling)
GET  /whale/orders/:id           (requireAuth + requireOrderParty) → order detail + action buttons
POST /whale/orders/:id/confirm   (requireAuth + requireSeller) → transitionOrder(CONFIRMED)
POST /whale/orders/:id/ship      (requireAuth + requireSeller) → transitionOrder(SHIPPED) + trackingNumber
POST /whale/orders/:id/deliver   (requireAuth + requireBuyer) → transitionOrder(COMPLETED)
POST /whale/orders/:id/cancel    (requireAuth + requireOrderParty) → transitionOrder(CANCELLED)
POST /whale/orders/:id/dispute   (requireAuth + requireBuyer) → transitionOrder(DISPUTED)
POST /whale/orders/:id/review    (requireAuth + requireBuyer + after COMPLETED) → whaleService.postReview
GET  /whale/dashboard            (requireAuth) → seller dashboard stats
GET  /whale/saved                (requireAuth) → saved listings grid
GET  /profile                    (requireAuth) → profile page
POST /profile                    (requireAuth) → userService.updateProfile
GET  /upgrade                    (requireAuth) → upgrade page
POST /upgrade/paymob             (requireAuth) → paymentService.createPaymobSession
POST /upgrade/paypal             (requireAuth) → paymentService.createPaypalOrder
GET  /payment/success            (requireAuth) → success page

# ── WEBHOOKS (no CSRF) ───────────────────────────────────────────────────
POST /webhooks/paymob            → paymentService.verifyPaymobWebhook → activateSubscription
POST /webhooks/paypal            → paymentService.capturePaypalOrder → activateSubscription

# ── ADMIN ────────────────────────────────────────────────────────────────
GET  /admin                      (requireAdmin) → admin dashboard
GET  /admin/users                (requireAdmin) → user list + search
POST /admin/users/:id/ban        (requireAdmin) → toggle isBanned
GET  /admin/listings             (requireAdmin) → listing moderation queue
POST /admin/listings/:id/remove  (requireAdmin) → whaleService.deleteListing(id, adminId, true)
GET  /admin/orders               (requireAdmin) → all orders with filters
POST /admin/orders/:id/resolve   (requireAdmin) → transitionOrder(COMPLETED or CANCELLED)
```

---

## SERVICE CONTRACTS

### `services/whaleService.js`

```javascript
// Implement all of these. Business logic only — no req/res, no rendering.

async function getListings(filters) {
  // filters: { q, categorySlug, city, condition, minPrice, maxPrice, sort, cursor }
  // cursor pagination: 24 items per page
  // sort options: newest (default), oldest, price_asc, price_desc, popular (by views)
  // Returns: { listings, nextCursor, total }
}

async function getListing(slugOrId) {
  // Find by slug first, then id
  // Increment views atomically
  // Include: seller.sellerProfile, reviews (with reviewer), category, subcategory
  // Returns: listing object with all relations
}

async function createListing(sellerId, data) {
  // data: { title, titleAr, description, descriptionAr, price, negotiable,
  //         condition, images[], categoryId, subcategoryId, city, tags[], specs }
  // Validate: seller exists, category exists, price > 0, at least 1 image
  // Slugify title to create unique slug (append cuid suffix if collision)
  // Set status to ACTIVE
  // Returns: created listing
}

async function updateListing(id, sellerId, data) {
  // Verify ownership (sellerId must match listing.sellerId)
  // Allow partial update of all fields except sellerId, createdAt
  // Re-slugify if title changed
  // Returns: updated listing
}

async function deleteListing(id, actorId, isAdmin = false) {
  // If not admin, verify ownership
  // Soft-delete: set status to REMOVED
  // Returns: updated listing
}

async function createOrder(data) {
  // data: { listingId, buyerId, quantity, paymentMethod, shippingAddress, buyerNote }
  // Validate: listing is ACTIVE, buyer !== seller, listing not already in PENDING order
  // Create order with status PENDING
  // Create OrderEvent { event: 'created', actorId: buyerId }
  // Emit notification to seller (type: ORDER)
  // Returns: created order with listing and buyer
}

async function transitionOrder(orderId, actorId, action, payload = {}) {
  // action is one of: confirm, ship, deliver, cancel, dispute, resolve
  // State machine — valid transitions only:
  //   confirm:  PENDING → CONFIRMED      (actor: seller)
  //   ship:     CONFIRMED → SHIPPED      (actor: seller, requires payload.trackingNumber)
  //   deliver:  SHIPPED|DELIVERED → COMPLETED (actor: buyer)
  //   cancel:   PENDING|CONFIRMED → CANCELLED (actor: buyer or seller, requires payload.reason)
  //   dispute:  SHIPPED|DELIVERED → DISPUTED  (actor: buyer)
  //   resolve:  DISPUTED → COMPLETED|CANCELLED (actor: admin)
  // On invalid transition: throw Error('INVALID_TRANSITION')
  // On wrong actor: throw Error('UNAUTHORIZED_ACTOR')
  // Always: create OrderEvent, send email notifications
  // Returns: updated order
}

async function postReview(orderId, reviewerId, data) {
  // data: { rating (1-5), body }
  // Validate: order status is COMPLETED, reviewerId is buyer, no existing review
  // Create Review
  // Update SellerProfile: recalculate avgRating and reviewCount
  // Emit notification to seller (type: REVIEW)
  // Returns: created review
}

async function toggleSaved(userId, listingId) {
  // Upsert/delete SavedListing
  // Returns: { saved: boolean }
}

async function getSellerDashboard(sellerId) {
  // Returns aggregated stats:
  // { totalListings, activeListings, totalOrders, pendingOrders,
  //   totalRevenue, avgRating, reviewCount, recentOrders[5] }
}
```

### `services/userService.js`

```javascript
async function register(data) {
  // data: { username, email, password }
  // Validate: username 3-30 chars alphanumeric+underscore, unique
  // Validate: email unique, valid format
  // Validate: password 8+ chars
  // Hash password with bcrypt 12 rounds
  // Create User with slug = slugify(username)
  // Create Subscription with plan='free', trialEndsAt = now + 30 days
  // Create SellerProfile with displayName = username
  // Send welcome email (non-blocking, catch errors)
  // Returns: created user
}

async function authenticate(identifier, password) {
  // identifier: email or username
  // Find user by email OR username
  // If not found: throw Error('USER_NOT_FOUND')
  // If isBanned: throw Error('USER_BANNED')
  // If no passwordHash (OAuth-only user): throw Error('OAUTH_ONLY')
  // Compare password with bcrypt
  // If wrong: throw Error('WRONG_PASSWORD')
  // Update lastSeenAt
  // Returns: user
}

async function findOrCreateOAuth(provider, providerId, profile) {
  // provider: 'google'
  // Check if user exists by googleId
  // If not: check if email already exists, link if so
  // If brand new: create User + Subscription + SellerProfile
  // Returns: { user, isNew }
}

async function getProfile(username, viewerId) {
  // Find user by username with sellerProfile, listings (ACTIVE, limit 12), reviews (limit 10)
  // If not found: throw Error('USER_NOT_FOUND')
  // Attach: isFollowing (future), savedCount for viewerId
  // Returns: profile object
}

async function updateProfile(userId, data) {
  // data: { bio, displayName, city, whatsapp } + optional avatar file
  // If avatar file provided: upload via utils/images.js, update avatarUrl
  // Update User.bio and SellerProfile fields
  // Returns: updated user with sellerProfile
}
```

### `services/emailService.js`

```javascript
// All functions are fire-and-forget (no await at call site, catch internally)
// Try SendGrid first, fall back to Nodemailer SMTP
// All emails are bilingual (AR + EN) in a simple HTML template

async function sendWelcome(user) {}
async function sendOrderPlaced(order) {}     // to seller
async function sendOrderConfirmed(order) {}  // to buyer
async function sendOrderShipped(order) {}    // to buyer with tracking
async function sendOrderCompleted(order) {}  // to both parties
async function sendTrialEnding(user, daysLeft) {}
```

### `services/paymentService.js`

```javascript
async function createPaymobSession(userId, planMonths) {
  // Create Payment record with status PENDING
  // Call Paymob API to get payment token
  // Returns: { iframeUrl, paymentId }
}

async function createPaypalOrder(userId, planMonths) {
  // Create Payment record with status PENDING
  // Create PayPal order via REST API
  // Returns: { approvalUrl, orderId }
}

async function capturePaypalOrder(paypalOrderId) {
  // Capture PayPal order
  // Call activateSubscription on success
  // Returns: { success, paymentId }
}

async function verifyPaymobWebhook(body, hmacHeader) {
  // Verify HMAC signature using PAYMOB_HMAC_SECRET
  // On success: call activateSubscription
  // Returns: { success }
}

async function activateSubscription(userId, planMonths) {
  // Update Subscription: plan='pro', paidUntil = now + planMonths months
  // Update Payment record: status COMPLETED
  // Send confirmation email (non-blocking)
  // Returns: updated subscription
}
```

---

## ORDER STATE MACHINE

The `transitionOrder` function must enforce this table. Any other transition throws `INVALID_TRANSITION`.

| From | Action | To | Actor |
|---|---|---|---|
| PENDING | confirm | CONFIRMED | seller |
| PENDING | cancel | CANCELLED | buyer or seller |
| CONFIRMED | ship | SHIPPED | seller |
| CONFIRMED | cancel | CANCELLED | buyer or seller |
| SHIPPED | deliver | COMPLETED | buyer |
| SHIPPED | dispute | DISPUTED | buyer |
| DELIVERED | deliver | COMPLETED | buyer |
| DELIVERED | dispute | DISPUTED | buyer |
| DISPUTED | resolve | COMPLETED or CANCELLED | admin |

**Notes:**
- `deliver` action maps `SHIPPED` → `COMPLETED` directly (no intermediate DELIVERED state for user-facing flow; DELIVERED can be set by shipping webhook integrations in future).
- `cancel` after SHIPPED or later is not allowed — buyer must use `dispute`.
- Every transition appends an `OrderEvent` record.

---

## CSS SPECIFICATION

Create `public/css/main.css` targeting ~500 lines. Use CSS custom properties for all design tokens. No Tailwind. No SCSS. No PostCSS.

```css
/* ── TOKENS ── */
:root {
  --surface-0: #ffffff;
  --surface-1: #f8f9fa;
  --surface-2: #f0f2f5;
  --surface-3: #e4e7ec;
  --brand: #1472a3;
  --brand-dark: #0f5a82;
  --brand-light: #e8f4fc;
  --text-primary: #111827;
  --text-secondary: #374151;
  --text-muted: #6b7280;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --border: #d1d5db;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 999px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-arabic: 'Tajawal', 'Arabic UI Text', sans-serif;
  --transition: 150ms ease;
}

html[data-theme="dark"] {
  --surface-0: #0f1117;
  --surface-1: #171b26;
  --surface-2: #1e2333;
  --surface-3: #252b3b;
  --text-primary: #f3f4f6;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border: #2d3348;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
}

html[dir="rtl"] {
  --font-sans: var(--font-arabic);
  /* Flip directional spacing where needed */
}

/* Load fonts from Google Fonts — add link in head.ejs */
/* Plus Jakarta Sans: 400,500,600,700 */
/* Tajawal: 400,500,700 */
```

**Required component classes:**
- `.card` — `background: var(--surface-1); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: 1.25rem;`
- `.btn` — base button reset, cursor pointer, transition
- `.btn-primary` — brand background, white text
- `.btn-ghost` — transparent, brand border + text
- `.btn-danger` — danger background, white text
- `.btn-sm` / `.btn-lg` — size variants
- `.form-group` — label + input stacked, gap 0.375rem
- `.input` — full width, surface-2 background, border, radius-md, focus ring in brand color
- `.badge` — small pill with color variants (`.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`)
- `.avatar` — circular image, sizes sm/md/lg via modifiers
- `.grid-listings` — `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;`
- `.skeleton` — animated loading placeholder (shimmer effect)
- `.navbar` — sticky top, surface-0 background, shadow-sm, flex layout
- `.container` — max-width 1200px, horizontal auto margins, horizontal padding 1rem
- Responsive: `@media (max-width: 768px)` collapses layout, stacks nav, adjusts grid

---

## EJS VIEWS — KEY TEMPLATES

### `views/partials/head.ejs`
```html
<!DOCTYPE html>
<html lang="<%= locale %>" dir="<%= dir %>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<%= csrfToken %>">
  <title><%= title ? title + ' — ' : '' %>Whale | الحوت</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body data-theme="<%= theme %>">
```

### `views/partials/navbar.ejs`
- Brand logo "🐋 الحوت / Whale" linking to `/`
- Nav links: Browse, Sell (if pro), Dashboard (if seller)
- Right side: language toggle (AR/EN), theme toggle (sun/moon icon), auth state (login/register buttons OR avatar dropdown with profile/orders/logout)
- Unread notification count badge
- All text bilingual: `<%= locale === 'ar' ? 'تصفح' : 'Browse' %>`

### `views/pages/home.ejs`
Structure:
1. Hero section: headline "اشتر وبع بأمان" / "Buy and Sell with Confidence", subtitle about escrow, two CTA buttons (Browse, Sell Now)
2. Category grid: 2-3 rows of category cards with icons
3. Trust section: 3 feature cards (Escrow Protection, Verified Sellers, Dispute Resolution)
4. Recent listings: grid of 8 latest ACTIVE listings using `listing-card.ejs` partial
5. CTA banner to sign up

### `views/whale/listing.ejs`
Structure:
1. Image gallery (main image + thumbnails, JS-powered swap)
2. Listing details: title, price, condition badge, city, views count
3. Seller card: avatar, name, rating stars, member since, "View Profile" link
4. Action buttons:
   - If buyer (not owner): "Buy Now" (→ checkout), "WhatsApp Seller", "Save" (heart toggle)
   - If owner: "Edit", "Delete"
5. Description tabs: AR / EN
6. Specs table (if specs exist)
7. Reviews section: rating summary + review list

### `views/whale/order.ejs`
Structure:
1. Order header: orderNumber, status badge, date
2. Order timeline: `OrderEvent` list as vertical timeline
3. Items: listing card (read-only)
4. Action buttons (conditionally rendered based on status + role):
   - Seller: Confirm, Ship (with tracking input), Cancel
   - Buyer: Confirm Delivery, Dispute, Cancel, Leave Review (after COMPLETED)
   - Admin: Resolve Dispute
5. Shipping info (if available)
6. Notes from buyer/seller

---

## `public/js/app.js` — VANILLA JS ONLY

Keep under 200 lines. Implement only:

```javascript
// 1. Theme toggle
// Read from localStorage('whale-theme') on load, apply to html[data-theme]
// Toggle button sets localStorage and data-theme

// 2. Language toggle
// POST to /locale with { locale: 'ar'|'en' } then reload
// OR use a simple link: <a href="/locale/ar"> that sets a session/cookie

// 3. Image gallery on listing page
// Click thumbnail → update main image src

// 4. Flash message auto-dismiss
// After 4 seconds, fade out flash messages

// 5. CSRF token injection for fetch() calls
// Read <meta name="csrf-token"> and attach to all non-GET fetch headers

// 6. Confirm dialogs for destructive actions
// data-confirm="Are you sure?" attribute → intercept submit, show window.confirm

// 7. Save/unsave toggle (optimistic UI)
// POST to /whale/listing/:id/save, toggle heart icon class
```

---

## MIDDLEWARE IMPLEMENTATIONS

### `middleware/auth.js`
```javascript
export const optionalAuth = (req, res, next) => {
  res.locals.user = req.user || null;
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  res.locals.user = req.user;
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).render('error', { message: 'Forbidden', status: 403 });
  }
  next();
};

// requirePro: check subscription plan is 'pro' AND paidUntil > now (or in trial)
export const requirePro = async (req, res, next) => { ... };
```

### `middleware/locale.js`
```javascript
// Read locale from: query ?lang= > session.locale > Accept-Language header > 'ar' default
// Set: req.locale, res.locals.locale, res.locals.dir ('rtl' for ar, 'ltr' for en)
// POST /locale route: set session.locale, redirect back
```

### `lib/i18n.js`
```javascript
// Simple key-value translations object
// t(key, locale, interpolations) function
// Support: ar, en
// Keys needed: all button labels, error messages, status labels, email subjects
// Expose as res.locals.t in locale middleware
```

---

## ENVIRONMENT VARIABLES

Create `.env.example` with all required variables:

```bash
# App
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
SESSION_SECRET=change-me-32-chars-minimum

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/whale

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Cloudinary (optional — falls back to local /uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SendGrid (optional — falls back to SMTP)
SENDGRID_API_KEY=

# SMTP fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@whale.ps

# Paymob
PAYMOB_API_KEY=
PAYMOB_IFRAME_ID=
PAYMOB_INTEGRATION_ID=
PAYMOB_HMAC_SECRET=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Anthropic (optional AI features)
ANTHROPIC_API_KEY=
```

---

## DOCKERFILE

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "entrypoint.js"]
```

## `entrypoint.js`

```javascript
const { execSync } = require('child_process');

console.log('Running database migrations...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });

console.log('Starting server...');
require('./server');
```

## `railway.toml`

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

---

## `package.json` scripts

```json
{
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node entrypoint.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "seed": "node prisma/seed.js",
    "test": "jest --forceExit"
  }
}
```

---

## TESTS — `__tests__/orderStateMachine.test.js`

Write a complete Jest test file. Use in-memory mocks — no database required. Import and test the state machine logic extracted from `whaleService.transitionOrder`.

**Required test cases:**

```javascript
describe('Order State Machine', () => {
  // Valid transitions
  test('PENDING + confirm → CONFIRMED (seller)')
  test('PENDING + cancel → CANCELLED (buyer)')
  test('PENDING + cancel → CANCELLED (seller)')
  test('CONFIRMED + ship + trackingNumber → SHIPPED (seller)')
  test('CONFIRMED + cancel → CANCELLED (buyer)')
  test('SHIPPED + deliver → COMPLETED (buyer)')
  test('SHIPPED + dispute → DISPUTED (buyer)')
  test('DISPUTED + resolve(complete) → COMPLETED (admin)')
  test('DISPUTED + resolve(cancel) → CANCELLED (admin)')

  // Invalid transitions (must throw INVALID_TRANSITION)
  test('COMPLETED + cancel → throws INVALID_TRANSITION')
  test('CANCELLED + confirm → throws INVALID_TRANSITION')
  test('PENDING + ship → throws INVALID_TRANSITION')
  test('PENDING + dispute → throws INVALID_TRANSITION')
  test('SHIPPED + confirm → throws INVALID_TRANSITION')

  // Wrong actor (must throw UNAUTHORIZED_ACTOR)
  test('PENDING + confirm → throws UNAUTHORIZED_ACTOR when actor is buyer')
  test('SHIPPED + deliver → throws UNAUTHORIZED_ACTOR when actor is seller')
  test('SHIPPED + dispute → throws UNAUTHORIZED_ACTOR when actor is seller')
  test('DISPUTED + resolve → throws UNAUTHORIZED_ACTOR when actor is not admin')

  // Missing required fields
  test('CONFIRMED + ship without trackingNumber → throws MISSING_TRACKING')
  test('PENDING + cancel without reason → throws MISSING_REASON')
})
```

Extract the state machine into a pure function `validateTransition(order, actorId, actorRole, action, payload)` that returns the new status or throws — this makes it easily testable without DB.

---

## SEED DATA

`prisma/seed.js` must create:
1. Admin user: `{ username: 'admin', email: 'admin@whale.ps', password: 'Admin1234!' }`
2. Demo seller: `{ username: 'demo_seller', email: 'seller@whale.ps', password: 'Demo1234!' }` with pro subscription
3. Demo buyer: `{ username: 'demo_buyer', email: 'buyer@whale.ps', password: 'Demo1234!' }`
4. 6 categories with Arabic names and icons:
   - Electronics / إلكترونيات (💻)
   - Vehicles / سيارات (🚗)
   - Real Estate / عقارات (🏠)
   - Fashion / أزياء (👗)
   - Home & Garden / منزل وحديقة (🏡)
   - Sports / رياضة (⚽)
5. 12 demo listings across categories in multiple Palestinian cities (Gaza, Ramallah, Nablus, Hebron, Jenin, Jerusalem)
6. 2 sample completed orders with reviews

---

## STATIC PAGE CONTENT

`/pages/:slug` renders markdown content. Implement these slugs with bilingual content:
- `about` — About Whale, mission, team
- `terms` — Terms of Service (escrow rules, fees, prohibited items)
- `privacy` — Privacy Policy (GDPR-aligned)
- `safety` — Safety Tips for buyers and sellers

Store as JS objects in `routes/index.js` or a `lib/pages.js` file — no external CMS needed.

---

## `server.js` STRUCTURE

```javascript
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const passport = require('./lib/passport');
const { localeMiddleware } = require('./middleware/locale');
const { optionalAuth } = require('./middleware/auth');

const app = express();

// 1. Security headers
app.use(helmet({ contentSecurityPolicy: { /* see security rules */ } }));

// 2. Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 3. Static files
app.use(express.static('public'));

// 4. Session
app.use(session({
  store: new PgSession({ conString: process.env.DATABASE_URL }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// 5. Passport
app.use(passport.initialize());
app.use(passport.session());

// 6. Locale
app.use(localeMiddleware);

// 7. CSRF (after session, before routes)
const csrfProtection = csrf({ cookie: false }); // uses session
app.use((req, res, next) => {
  // Exclude webhook routes
  if (req.path.startsWith('/webhooks/')) return next();
  csrfProtection(req, res, next);
});
app.use((req, res, next) => {
  if (req.csrfToken) res.locals.csrfToken = req.csrfToken();
  next();
});

// 8. Auth (populate res.locals.user)
app.use(optionalAuth);

// 9. Flash messages
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;
  next();
});

// 10. View engine
app.set('view engine', 'ejs');
app.set('views', './views');

// 11. Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/whale', require('./routes/whale'));
app.use('/profile', require('./routes/profile'));
app.use('/upgrade', require('./routes/payment'));
app.use('/payment', require('./routes/payment'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/admin', require('./routes/admin'));

// 12. Redirects
app.get('/marketplace', (req, res) => res.redirect(301, '/whale'));
app.get('/market', (req, res) => res.redirect(301, '/whale'));
app.get('/rooms', (req, res) => res.redirect(301, '/whale'));

// 13. 404 + Error handlers
app.use((req, res) => res.status(404).render('404', { title: '404' }));
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', { message: 'Invalid CSRF token', status: 403 });
  }
  console.error(err);
  res.status(err.status || 500).render('error', {
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    status: err.status || 500
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Whale running on port ${PORT}`));

module.exports = app;
```

---

## `utils/sanitize.js`

```javascript
// strip(str) — remove all HTML tags, trim whitespace, return string
// truncate(str, maxLen) — truncate to maxLen characters
// sanitizeBody(body, schema) — apply strip + truncate to each field per schema
// Example schema: { title: 100, description: 5000, bio: 500, city: 100 }
// Return new object with only schema-defined keys (implicit field allowlist)
```

---

## ROUTE IMPLEMENTATION PATTERN

Every route file must follow this pattern — thin handler, no business logic:

```javascript
// routes/whale.js (excerpt)
const router = require('express').Router();
const whaleService = require('../services/whaleService');
const { requireAuth, requirePro } = require('../middleware/auth');
const { sanitizeBody } = require('../utils/sanitize');

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      q: req.query.q,
      categorySlug: req.query.category,
      city: req.query.city,
      condition: req.query.condition,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      sort: req.query.sort,
      cursor: req.query.cursor
    };
    const { listings, nextCursor, total } = await whaleService.getListings(filters);
    const categories = await whaleService.getCategories();
    res.render('whale/index', {
      title: res.locals.locale === 'ar' ? 'تصفح المنتجات' : 'Browse',
      listings,
      nextCursor,
      total,
      categories,
      filters
    });
  } catch (err) {
    next(err);
  }
});

// All other routes follow same try/catch + next(err) pattern
```

---

## VERIFICATION CHECKLIST

After generating all code, verify the following before declaring done:

- [ ] `npm install` — zero errors
- [ ] `npx prisma generate` — success
- [ ] `node prisma/seed.js` — creates seed data without errors
- [ ] `npm run dev` — server starts, `GET /health` returns `{ status: 'ok' }`
- [ ] `GET /` — home page renders with categories and recent listings
- [ ] `GET /whale` — browse page renders with filter sidebar and listing grid
- [ ] Register flow: `POST /auth/register` → auto-login → redirect `/whale`
- [ ] Create listing flow: login as demo_seller → `GET /whale/sell` → `POST /whale/sell` → listing appears in browse
- [ ] Buy flow: login as demo_buyer → `GET /whale/checkout/:id` → `POST /whale/checkout/:id` → order created
- [ ] Order flow: seller confirms → ships (with tracking) → buyer confirms delivery → COMPLETED
- [ ] Review: after COMPLETED, buyer can post review, seller's avgRating updates
- [ ] `npm test` — all state machine tests pass
- [ ] `docker build . -t whale` — builds without error
- [ ] Dark mode toggle works and persists in localStorage
- [ ] Arabic/English toggle switches `lang`, `dir`, and font family
- [ ] All forms include `_csrf` hidden field
- [ ] No `<%-` for user content anywhere in views
- [ ] Admin can ban user, remove listing, resolve dispute
- [ ] `/marketplace`, `/market`, `/rooms` all 301 redirect to `/whale`

---

## COMMON PITFALLS TO AVOID

1. **Do not** create 67 view files — stick to the 22 listed above, use partials aggressively.
2. **Do not** add `Forum`, `Room`, `Message`, `Follow`, `Tag`, or `Report` models — they are explicitly excluded.
3. **Do not** implement Facebook or Apple OAuth — Google only.
4. **Do not** put business logic in route files — services only.
5. **Do not** use `<%-` for any user-supplied content in EJS.
6. **Do not** skip CSRF on any POST route except `/webhooks/*`.
7. **Do not** use `bcrypt` rounds below 12.
8. **Do not** use `$queryRaw` with string interpolation in Prisma.
9. **Do not** create a CSS file over 600 lines — extract components, not one-offs.
10. **Do not** add Facebook Pixel, Google Analytics, or any third-party tracking scripts.
11. **Do not** implement a chat/messaging system — WhatsApp deep links only.
12. **Do not** add a Redux store, React, Vue, or any frontend framework — vanilla JS only.
13. **Do not** add `eslint`, `prettier`, `husky`, or other dev tooling — keep it simple.
14. **Do not** create a separate API layer with JWT — session-based auth throughout.
15. **Do not** implement email verification on registration — keep the signup flow frictionless; verification is a future milestone.

---

## OUTPUT EXPECTATIONS

When you (the AI receiving this prompt) are done, the deliverable is:

1. All files listed in the folder structure — fully implemented, not stubbed
2. Every route in the route map — working end-to-end
3. Every service function — implemented with proper error handling
4. All 22 EJS templates — complete HTML, not placeholder `<p>TODO</p>`
5. `main.css` — all token variables + all component classes, ~500 lines
6. `app.js` — all 7 JS features implemented, under 200 lines
7. `__tests__/orderStateMachine.test.js` — all test cases passing
8. `prisma/seed.js` — executable, creates all seed data
9. `.env.example` — all variables documented
10. `Dockerfile` + `entrypoint.js` + `railway.toml` — deploy-ready

**Do not ask clarifying questions. Make reasonable decisions for any gap, document the decision in a code comment, and move on.**

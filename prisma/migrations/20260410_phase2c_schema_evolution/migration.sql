-- Phase 2C/2D Schema Evolution
-- All new columns are nullable or have defaults to avoid breaking existing data.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.1: Address fields for MENA shipping
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'PS';
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.2: Order price breakdown
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- Backfill: set subtotal = amount for existing orders
UPDATE "Order" SET "subtotal" = "amount" WHERE "subtotal" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.3: Listing shipping/product fields
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(8,2);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "dimensions" JSONB;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

CREATE INDEX IF NOT EXISTS "Listing_vendorId_idx" ON "Listing"("vendorId");
CREATE INDEX IF NOT EXISTS "Listing_sku_idx" ON "Listing"("sku");
CREATE INDEX IF NOT EXISTS "Order_vendorId_idx" ON "Order"("vendorId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.7: Payment multi-currency audit trail
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "originalCurrency" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(12,6);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Review bilingual body
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "bodyAr" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Category tree (self-referencing)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Notification type extension
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.4: ListingTranslation
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ListingTranslation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specs" JSONB,
    CONSTRAINT "ListingTranslation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ListingTranslation_listingId_locale_key" ON "ListingTranslation"("listingId", "locale");
ALTER TABLE "ListingTranslation" ADD CONSTRAINT "ListingTranslation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: ProductVariant
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sku" TEXT,
    "attributes" JSONB NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductVariant_listingId_idx" ON "ProductVariant"("listingId");
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_idx" ON "ProductVariant"("sku");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.5/2D: Vendor (multi-vendor marketplace)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
    CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "banner" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "payoutMethod" TEXT,
    "payoutDetails" JSONB,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_userId_key" ON "Vendor"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_slug_key" ON "Vendor"("slug");
CREATE INDEX IF NOT EXISTS "Vendor_status_idx" ON "Vendor"("status");
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK from Listing/Order to Vendor
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- VendorPayout
CREATE TABLE IF NOT EXISTS "VendorPayout" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "period" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VendorPayout_vendorId_idx" ON "VendorPayout"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorPayout_status_idx" ON "VendorPayout"("status");
ALTER TABLE "VendorPayout" ADD CONSTRAINT "VendorPayout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: Shipping zones & rates
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "cities" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "weightMin" DECIMAL(8,2),
    "weightMax" DECIMAL(8,2),
    "cost" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "freeAbove" DECIMAL(12,2),
    "estDays" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShippingRate_zoneId_idx" ON "ShippingRate"("zoneId");
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2C.6: ExchangeRate
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCur" TEXT NOT NULL,
    "toCur" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_fromCur_toCur_key" ON "ExchangeRate"("fromCur", "toCur");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: Messaging
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "orderId" TEXT,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_receiverId_idx" ON "Message"("receiverId");
CREATE INDEX IF NOT EXISTS "Message_orderId_idx" ON "Message"("orderId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt");
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: ReturnRequest
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "returnTrackingNumber" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReturnRequest_orderId_key" ON "ReturnRequest"("orderId");
CREATE INDEX IF NOT EXISTS "ReturnRequest_status_idx" ON "ReturnRequest"("status");
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: BrowsingHistory
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "BrowsingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrowsingHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BrowsingHistory_userId_listingId_key" ON "BrowsingHistory"("userId", "listingId");
CREATE INDEX IF NOT EXISTS "BrowsingHistory_userId_viewedAt_idx" ON "BrowsingHistory"("userId", "viewedAt" DESC);
ALTER TABLE "BrowsingHistory" ADD CONSTRAINT "BrowsingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrowsingHistory" ADD CONSTRAINT "BrowsingHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: SearchLog
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "SearchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SearchLog_query_idx" ON "SearchLog"("query");
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2D: Banner / Promotions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "image" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'home_hero',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Banner_position_isActive_idx" ON "Banner"("position", "isActive");

-- FK for Category self-reference
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

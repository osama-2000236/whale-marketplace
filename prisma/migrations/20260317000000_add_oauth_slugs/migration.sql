-- Add OAuth fields to User
ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "googleId" TEXT,
ADD COLUMN "facebookId" TEXT,
ADD COLUMN "appleId" TEXT,
ADD COLUMN "oauthProvider" TEXT,
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Add listing slug for SEO URLs
ALTER TABLE "MarketListing"
ADD COLUMN "slug" TEXT;

-- Unique indexes
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
CREATE UNIQUE INDEX "MarketListing_slug_key" ON "MarketListing"("slug");

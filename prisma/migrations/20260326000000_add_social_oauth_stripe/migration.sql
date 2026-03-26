-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'STRIPE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "facebookId" TEXT,
ADD COLUMN "appleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");

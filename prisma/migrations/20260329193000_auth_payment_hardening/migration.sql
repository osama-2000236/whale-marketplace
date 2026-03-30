-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'EMAIL_CHANGE';

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'ORDER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "Payment" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'SUBSCRIPTION';

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail");

-- Contact Health & Suppression System: replaces the single optedOut boolean with a
-- richer marketing status. optedOut/optedOutAt are kept as a synced mirror (not
-- removed) since api-v1.ts already exposes optedOut to external API consumers.

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'BLACKLISTED', 'INVALID', 'DORMANT', 'FAILED_DELIVERY');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Contact" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Contact" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "statusChangedBy" TEXT;
ALTER TABLE "Contact" ADD COLUMN "engagementScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Contact" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing opted-out contacts onto the new status
UPDATE "Contact" SET "status" = 'UNSUBSCRIBED', "statusChangedAt" = "optedOutAt" WHERE "optedOut" = true;

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

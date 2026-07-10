-- Reply-Based Interest Filtering: classifies inbound replies as Interested /
-- Not Interested via keyword matching. Flag-only -- does not affect campaign
-- suppression (isSuppressed()/ContactStatus are untouched).

-- CreateEnum
CREATE TYPE "ReplyIntent" AS ENUM ('UNKNOWN', 'INTERESTED', 'NOT_INTERESTED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "replyIntent" "ReplyIntent" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Contact" ADD COLUMN "replyIntentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "replyIntentSample" TEXT;

-- CreateIndex
CREATE INDEX "Contact_replyIntent_idx" ON "Contact"("replyIntent");

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('COMPANY_SUSPENDED', 'COMPANY_ACTIVATED', 'COMPANY_SOFT_DELETED', 'COMPANY_RESTORED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'USER_FORCE_LOGOUT', 'SUPER_ADMIN_GRANTED', 'SUPER_ADMIN_REVOKED', 'IMPERSONATION_STARTED', 'IMPERSONATION_ENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WhatsAppNumber" ADD COLUMN     "lastHealthCheckAt" TIMESTAMP(3),
ADD COLUMN     "metaMessagingLimitTier" TEXT,
ADD COLUMN     "qualityRating" TEXT,
ADD COLUMN     "wabaVerificationStatus" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedByUserId" TEXT,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


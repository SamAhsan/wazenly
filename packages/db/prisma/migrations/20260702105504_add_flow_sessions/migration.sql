-- CreateEnum
CREATE TYPE "FlowSessionState" AS ENUM ('WAITING_INPUT', 'WAITING_DELAY');

-- CreateTable
CREATE TABLE "FlowSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "numberId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "state" "FlowSessionState" NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlowSession_contactId_numberId_key" ON "FlowSession"("contactId", "numberId");

-- AddForeignKey
ALTER TABLE "FlowSession" ADD CONSTRAINT "FlowSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowSession" ADD CONSTRAINT "FlowSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

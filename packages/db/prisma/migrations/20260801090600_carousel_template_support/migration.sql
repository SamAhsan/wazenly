-- AlterEnum
ALTER TYPE "TemplateHeaderType" ADD VALUE 'CAROUSEL';

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "cards" JSONB;

-- DropIndex
DROP INDEX "profiles_organizationId_document_key";

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "allowDuplicateDocuments" BOOLEAN NOT NULL DEFAULT false;

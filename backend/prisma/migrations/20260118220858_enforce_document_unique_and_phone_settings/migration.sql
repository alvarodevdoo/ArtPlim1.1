/*
  Warnings:

  - You are about to drop the column `allowDuplicateDocuments` on the `organization_settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,document]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organization_settings" DROP COLUMN "allowDuplicateDocuments",
ADD COLUMN     "allowDuplicatePhones" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_organizationId_document_key" ON "profiles"("organizationId", "document");

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_subdomain_key" ON "organizations"("subdomain");

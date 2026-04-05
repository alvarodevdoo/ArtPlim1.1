/*
  Warnings:

  - You are about to drop the column `category` on the `materials` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `materials` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "materials_organizationId_category_idx";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "expenseAccountId" TEXT,
ADD COLUMN     "inventoryAccountId" TEXT;

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "ean" TEXT,
ADD COLUMN     "ncm" TEXT;

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "enableCategoryAppropriation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "freightExpenseAccountId" TEXT,
ADD COLUMN     "inventoryValuationMethod" TEXT NOT NULL DEFAULT 'AVERAGE',
ADD COLUMN     "recoveryToken" TEXT,
ADD COLUMN     "taxExpenseAccountId" TEXT;

-- CreateIndex
CREATE INDEX "materials_organizationId_categoryId_idx" ON "materials"("organizationId", "categoryId");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

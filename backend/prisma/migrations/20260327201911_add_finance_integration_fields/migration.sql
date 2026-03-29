-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "defaultReceivableCategoryId" TEXT,
ADD COLUMN     "defaultRevenueCategoryId" TEXT;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "feeCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

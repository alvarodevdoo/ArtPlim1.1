-- DropForeignKey
ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_feeCategoryId_fkey";

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `nature` to the `chart_of_accounts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `chart_of_accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ChartAccountType" AS ENUM ('SYNTHETIC', 'ANALYTIC');

-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE', 'RESULT_CALCULATION', 'CONTROL');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "chartOfAccountId" TEXT;

-- AlterTable
ALTER TABLE "chart_of_accounts" ADD COLUMN     "description" TEXT,
ADD COLUMN     "nature" "AccountNature" NOT NULL,
ADD COLUMN     "parentId" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "ChartAccountType" NOT NULL;

-- DropEnum
DROP TYPE "ChartOfAccountType";

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_chartOfAccountId_fkey" FOREIGN KEY ("chartOfAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

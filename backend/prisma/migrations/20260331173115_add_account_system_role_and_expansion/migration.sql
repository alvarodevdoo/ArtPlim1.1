-- CreateEnum
CREATE TYPE "AccountSystemRole" AS ENUM ('GENERAL', 'BANK_ACCOUNT', 'INVENTORY', 'REVENUE_SALE', 'COST_EXPENSE', 'RECEIVABLE', 'PAYABLE', 'TAX', 'FIXED_ASSET', 'EQUITY');

-- AlterTable
ALTER TABLE "chart_of_accounts" ADD COLUMN     "systemRole" "AccountSystemRole" NOT NULL DEFAULT 'GENERAL';

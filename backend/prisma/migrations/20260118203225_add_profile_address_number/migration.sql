/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('PIX', 'CARD', 'CASH', 'TRANSFER', 'BOLETO', 'OTHER');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationPaymentAction" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancellationRefundAmount" DECIMAL(10,2),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "inProductionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "enableFinanceReports" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "auditNotes" TEXT,
ADD COLUMN     "paymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "budgetNumber" TEXT NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "width" DECIMAL(10,3),
    "height" DECIMAL(10,3),
    "quantity" INTEGER NOT NULL,
    "totalArea" DECIMAL(10,6),
    "attributes" JSONB,
    "paperSize" TEXT,
    "paperType" TEXT,
    "printColors" TEXT,
    "finishing" TEXT,
    "customSizeName" TEXT,
    "isCustomSize" BOOLEAN NOT NULL DEFAULT false,
    "machineTime" DOUBLE PRECISION,
    "setupTime" DOUBLE PRECISION,
    "complexity" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "calculatedPrice" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "feePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "installmentRules" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_organizationId_budgetNumber_key" ON "budgets"("organizationId", "budgetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

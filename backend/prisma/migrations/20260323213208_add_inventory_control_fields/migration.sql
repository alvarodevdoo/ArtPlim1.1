/*
  Warnings:

  - You are about to drop the `insumos` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'BILLED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChartOfAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ConsumptionRule" AS ENUM ('AREA', 'PERIMETER', 'SPACING', 'FIXED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'DEBIT';
ALTER TYPE "TransactionType" ADD VALUE 'CREDIT';

-- DropForeignKey
ALTER TABLE "ficha_tecnica_insumos" DROP CONSTRAINT "ficha_tecnica_insumos_insumoId_fkey";

-- DropForeignKey
ALTER TABLE "insumo_fornecedores" DROP CONSTRAINT "insumo_fornecedores_insumoId_fkey";

-- DropForeignKey
ALTER TABLE "insumos" DROP CONSTRAINT "insumos_organizationId_fkey";

-- AlterTable
ALTER TABLE "ficha_tecnica_insumos" ADD COLUMN     "linkedQuantityVariable" TEXT,
ADD COLUMN     "linkedVariable" TEXT;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Outros',
ADD COLUMN     "defaultConsumptionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
ADD COLUMN     "defaultConsumptionRule" "ConsumptionRule" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "expenseAccountId" TEXT,
ADD COLUMN     "inventoryAccountId" TEXT,
ADD COLUMN     "minStockQuantity" DOUBLE PRECISION,
ADD COLUMN     "sellWithoutStock" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sellWithoutStock" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "payableId" TEXT,
ADD COLUMN     "profileId" TEXT,
ADD COLUMN     "receivableId" TEXT,
ADD COLUMN     "userId" TEXT;

-- DropTable
DROP TABLE "insumos";

-- DropEnum
DROP TYPE "UnidadeBase";

-- CreateTable
CREATE TABLE "material_receipts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payableId" TEXT,

    CONSTRAINT "material_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_suppliers" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" TEXT,
    "costPrice" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unitPrice" DECIMAL(10,4) NOT NULL,
    "totalPrice" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "ChartOfAccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_suppliers_materialId_supplierId_key" ON "material_suppliers"("materialId", "supplierId");

-- CreateIndex
CREATE INDEX "materials_organizationId_idx" ON "materials"("organizationId");

-- CreateIndex
CREATE INDEX "materials_organizationId_category_idx" ON "materials"("organizationId", "category");

-- CreateIndex
CREATE INDEX "materials_organizationId_active_idx" ON "materials"("organizationId", "active");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_insumos" ADD CONSTRAINT "ficha_tecnica_insumos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_fornecedores" ADD CONSTRAINT "insumo_fornecedores_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "material_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

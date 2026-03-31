/*
  Warnings:

  - The values [AREA,FIXED] on the enum `ConsumptionRule` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `standardLength` on the `materials` table. All the data in the column will be lost.
  - You are about to drop the column `standardWidth` on the `materials` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ControlUnit" AS ENUM ('UN', 'M', 'M2', 'ML');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'INTERNAL_CONSUMPTION', 'ADJUSTMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "ConsumptionRule_new" AS ENUM ('FIXED_UNIT', 'PRODUCT_AREA', 'PERIMETER', 'SPACING');
ALTER TABLE "materials" ALTER COLUMN "defaultConsumptionRule" DROP DEFAULT;
ALTER TABLE "materials" ALTER COLUMN "defaultConsumptionRule" TYPE "ConsumptionRule_new" USING ("defaultConsumptionRule"::text::"ConsumptionRule_new");
ALTER TYPE "ConsumptionRule" RENAME TO "ConsumptionRule_old";
ALTER TYPE "ConsumptionRule_new" RENAME TO "ConsumptionRule";
DROP TYPE "ConsumptionRule_old";
ALTER TABLE "materials" ALTER COLUMN "defaultConsumptionRule" SET DEFAULT 'FIXED_UNIT';
COMMIT;

-- AlterTable
ALTER TABLE "material_suppliers" ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "preferredPaymentDay" INTEGER;

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "standardLength",
DROP COLUMN "standardWidth",
ADD COLUMN     "averageCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
ADD COLUMN     "controlUnit" "ControlUnit",
ADD COLUMN     "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "currentStock" DECIMAL(15,4) NOT NULL DEFAULT 0,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "spedType" TEXT,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "width" DOUBLE PRECISION,
ALTER COLUMN "defaultConsumptionRule" SET DEFAULT 'FIXED_UNIT';

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "requireDocumentKeyForEntry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "revenueAccountId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "accrualDate" TIMESTAMP(3),
ADD COLUMN     "paymentDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_items" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unitCost" DECIMAL(10,4) NOT NULL,
    "totalCost" DECIMAL(10,4) NOT NULL,
    "machineId" TEXT,
    "machineCounter" INTEGER,
    "notes" TEXT,
    "supplierId" TEXT,
    "documentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_idx" ON "stock_movements"("organizationId");

-- CreateIndex
CREATE INDEX "stock_movements_materialId_idx" ON "stock_movements"("materialId");

-- CreateIndex
CREATE INDEX "stock_movements_supplierId_idx" ON "stock_movements"("supplierId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

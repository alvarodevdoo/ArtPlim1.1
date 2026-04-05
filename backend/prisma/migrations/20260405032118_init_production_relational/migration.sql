/*
  Warnings:

  - The values [PENDING,PAUSED,COMPLETED] on the enum `ProductionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `status` column on the `production_operations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'DOING', 'DONE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
BEGIN;
CREATE TYPE "ProductionStatus_new" AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
ALTER TABLE "production_queue" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "production_queue" ALTER COLUMN "status" TYPE "ProductionStatus_new" USING ("status"::text::"ProductionStatus_new");
ALTER TABLE "production_orders" ALTER COLUMN "status" TYPE "ProductionStatus_new" USING ("status"::text::"ProductionStatus_new");
ALTER TYPE "ProductionStatus" RENAME TO "ProductionStatus_old";
ALTER TYPE "ProductionStatus_new" RENAME TO "ProductionStatus";
DROP TYPE "ProductionStatus_old";
ALTER TABLE "production_queue" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "defaultProductionSteps" JSONB;

-- AlterTable
ALTER TABLE "production_operations" DROP COLUMN "status",
ADD COLUMN     "status" "StepStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "production_queue" ALTER COLUMN "status" SET DEFAULT 'WAITING';

-- DropEnum
DROP TYPE "OperationStatus";

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'WAITING',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "pickingList" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_steps" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "operatorId" TEXT,

    CONSTRAINT "production_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_orderItemId_key" ON "production_orders"("orderItemId");

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

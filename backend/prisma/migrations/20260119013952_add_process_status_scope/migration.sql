-- CreateEnum
CREATE TYPE "StatusScope" AS ENUM ('ORDER', 'ITEM', 'BOTH');

-- AlterTable
ALTER TABLE "budget_items" ADD COLUMN     "processStatusId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "processStatusId" TEXT;

-- AlterTable
ALTER TABLE "process_statuses" ADD COLUMN     "scope" "StatusScope" NOT NULL DEFAULT 'ORDER';

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_processStatusId_fkey" FOREIGN KEY ("processStatusId") REFERENCES "process_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_processStatusId_fkey" FOREIGN KEY ("processStatusId") REFERENCES "process_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

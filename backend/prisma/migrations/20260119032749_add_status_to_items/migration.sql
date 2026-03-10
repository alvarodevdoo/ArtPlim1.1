-- AlterTable
ALTER TABLE "budget_items" ADD COLUMN     "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT';

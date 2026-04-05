-- AlterTable
ALTER TABLE "configuration_options" ADD COLUMN     "materialId" TEXT,
ADD COLUMN     "slotQuantity" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "compositionSnapshot" JSONB,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "profitAtSale" DECIMAL(10,4),
ADD COLUMN     "unitCostAtSale" DECIMAL(10,4),
ADD COLUMN     "unitPriceAtSale" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "targetMargin" DOUBLE PRECISION,
ADD COLUMN     "targetMarkup" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "option_incompatibilities" (
    "id" TEXT NOT NULL,
    "optionAId" TEXT NOT NULL,
    "optionBId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "option_incompatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "option_incompatibilities_optionAId_optionBId_key" ON "option_incompatibilities"("optionAId", "optionBId");

-- AddForeignKey
ALTER TABLE "configuration_options" ADD CONSTRAINT "configuration_options_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_incompatibilities" ADD CONSTRAINT "option_incompatibilities_optionAId_fkey" FOREIGN KEY ("optionAId") REFERENCES "configuration_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_incompatibilities" ADD CONSTRAINT "option_incompatibilities_optionBId_fkey" FOREIGN KEY ("optionBId") REFERENCES "configuration_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

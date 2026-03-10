/*
  Warnings:

  - You are about to drop the column `customTypeId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `product_custom_types` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "product_custom_types" DROP CONSTRAINT "product_custom_types_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_customTypeId_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "customTypeId",
ADD COLUMN     "pricingRuleId" TEXT;

-- DropTable
DROP TABLE "product_custom_types";

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" "ItemType" NOT NULL,
    "formula" JSONB NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "processStatusId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "customTypeId" TEXT;

-- CreateTable
CREATE TABLE "process_statuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "mappedBehavior" "OrderStatus" NOT NULL,
    "allowEdition" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_custom_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "baseType" "ItemType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_custom_types_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "product_custom_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_processStatusId_fkey" FOREIGN KEY ("processStatusId") REFERENCES "process_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_statuses" ADD CONSTRAINT "process_statuses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_statuses" ADD CONSTRAINT "process_statuses_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "process_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_custom_types" ADD CONSTRAINT "product_custom_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

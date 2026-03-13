-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stockMinQuantity" DOUBLE PRECISION,
ADD COLUMN     "stockQuantity" DOUBLE PRECISION,
ADD COLUMN     "stockUnit" TEXT,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;

/*
  Warnings:

  - A unique constraint covering the columns `[productId,insumoId]` on the table `ficha_tecnica_insumos` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ficha_tecnica_insumos_productId_idx";

-- DropIndex
DROP INDEX "ficha_tecnica_insumos_productId_insumoId_configurationOptio_key";

-- CreateIndex
CREATE UNIQUE INDEX "ficha_tecnica_insumos_productId_insumoId_key" ON "ficha_tecnica_insumos"("productId", "insumoId");

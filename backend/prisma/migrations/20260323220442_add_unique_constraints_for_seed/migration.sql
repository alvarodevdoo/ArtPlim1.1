/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,insumoId,configurationOptionId]` on the table `ficha_tecnica_insumos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `materials` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `pricing_rules` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "accounts_organizationId_name_key" ON "accounts"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_tecnica_insumos_productId_insumoId_configurationOptio_key" ON "ficha_tecnica_insumos"("productId", "insumoId", "configurationOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "materials_organizationId_name_key" ON "materials"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_organizationId_name_key" ON "pricing_rules"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_name_key" ON "products"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_organizationId_name_key" ON "profiles"("organizationId", "name");

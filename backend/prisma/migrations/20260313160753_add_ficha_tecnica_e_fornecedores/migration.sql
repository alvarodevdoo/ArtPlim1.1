-- CreateTable
CREATE TABLE "ficha_tecnica_insumos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "productId" TEXT,
    "configurationOptionId" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "custoCalculado" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ficha_tecnica_insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo_fornecedores" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "precoCusto" DECIMAL(10,4),
    "referencia" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumo_fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ficha_tecnica_insumos_productId_idx" ON "ficha_tecnica_insumos"("productId");

-- CreateIndex
CREATE INDEX "ficha_tecnica_insumos_configurationOptionId_idx" ON "ficha_tecnica_insumos"("configurationOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_fornecedores_insumoId_fornecedorId_key" ON "insumo_fornecedores"("insumoId", "fornecedorId");

-- AddForeignKey
ALTER TABLE "ficha_tecnica_insumos" ADD CONSTRAINT "ficha_tecnica_insumos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_insumos" ADD CONSTRAINT "ficha_tecnica_insumos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_insumos" ADD CONSTRAINT "ficha_tecnica_insumos_configurationOptionId_fkey" FOREIGN KEY ("configurationOptionId") REFERENCES "configuration_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_insumos" ADD CONSTRAINT "ficha_tecnica_insumos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_fornecedores" ADD CONSTRAINT "insumo_fornecedores_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_fornecedores" ADD CONSTRAINT "insumo_fornecedores_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

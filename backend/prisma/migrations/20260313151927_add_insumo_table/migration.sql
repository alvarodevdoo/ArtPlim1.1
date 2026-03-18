-- CreateEnum
CREATE TYPE "UnidadeBase" AS ENUM ('KG', 'M2', 'M', 'UN', 'LITRO');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "formulaData" JSONB,
ADD COLUMN     "localFormulaId" TEXT;

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadeBase" "UnidadeBase" NOT NULL,
    "custoUnitario" DECIMAL(10,4) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insumos_organizationId_idx" ON "insumos"("organizationId");

-- CreateIndex
CREATE INDEX "insumos_organizationId_categoria_idx" ON "insumos"("organizationId", "categoria");

-- CreateIndex
CREATE INDEX "insumos_organizationId_ativo_idx" ON "insumos"("organizationId", "ativo");

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

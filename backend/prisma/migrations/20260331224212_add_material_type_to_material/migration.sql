-- CreateEnum
CREATE TYPE "SpedAccountType" AS ENUM ('INVENTORY', 'EXPENSE');

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "materialTypeId" TEXT;

-- CreateTable
CREATE TABLE "MaterialType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spedCode" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpedAccountMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "materialTypeId" TEXT,
    "spedType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mappingType" "SpedAccountType" NOT NULL DEFAULT 'EXPENSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpedAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialType_organizationId_idx" ON "MaterialType"("organizationId");

-- CreateIndex
CREATE INDEX "SpedAccountMapping_organizationId_materialTypeId_idx" ON "SpedAccountMapping"("organizationId", "materialTypeId");

-- AddForeignKey
ALTER TABLE "MaterialType" ADD CONSTRAINT "MaterialType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpedAccountMapping" ADD CONSTRAINT "SpedAccountMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpedAccountMapping" ADD CONSTRAINT "SpedAccountMapping_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpedAccountMapping" ADD CONSTRAINT "SpedAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,code]` on the table `chart_of_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_organizationId_code_key" ON "chart_of_accounts"("organizationId", "code");

-- AlterTable: vincular opções de configuração a variáveis da fórmula (motor DYNAMIC_ENGINEER)
ALTER TABLE "configuration_options"
  ADD COLUMN "formulaOp" TEXT,
  ADD COLUMN "formulaVariableTarget" TEXT;

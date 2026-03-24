import { PrismaClient, ReceiptStatus, PayableStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { AppError } from '../../shared/infrastructure/errors/AppError';

export interface CloseReceiptsInput {
  organizationId: string;
  supplierId: string;
  receiptIds: string[];
  dueDate: Date;
  stockAccountId: string;
  supplierAccountId: string;
  notes?: string;
  categoryId?: string;
  userId: string;
}

export class BillingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Fecha uma ou mais faturas (MaterialReceipt) gerando um Contas a Pagar (AccountPayable)
   * e realizando o lançamento de Partidas Dobradas:
   *
   *   DÉBITO  → Conta de Estoque de Insumos (Ativo)   – aumenta o valor do estoque
   *   CRÉDITO → Conta de Fornecedores a Pagar (Passivo) – registra a obrigação
   *
   * O tipo DEBIT/CREDIT nunca impacta o DRE; somente INCOME/EXPENSE o afetam.
   *
   * Regras Estritas:
   * 1. Isolamento Multi-tenant (organizationId em todos os where)
   * 2. Prevenção de Concorrência (status: PENDING no findMany e updateMany)
   * 3. Rastreabilidade (payableId em cada Transaction gerada)
   */
  async closeReceipts(input: CloseReceiptsInput) {
    const {
      organizationId,
      supplierId,
      receiptIds,
      dueDate,
      stockAccountId,
      supplierAccountId,
      notes,
      categoryId,
      userId
    } = input;

    if (!receiptIds || receiptIds.length === 0) {
      throw new AppError('Nenhum recibo informado para fechamento.', 400);
    }

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. Buscar recibos garantindo MULTI-TENANT e CONCURRENCY ──────────────
      const receipts = await tx.materialReceipt.findMany({
        where: {
          id: { in: receiptIds },
          organizationId,
          supplierId,
          status: ReceiptStatus.PENDING // Concorrência: lê só o que está PENDING
        }
      });

      if (receipts.length !== receiptIds.length) {
        throw new AppError(
          'Um ou mais recibos não encontrados, já faturados ou de outro fornecedor.',
          400
        );
      }

      // ── 2. Calcular valor total ────────────────────────────────────────────────
      const totalAmount = receipts.reduce((sum, r) => sum + Number(r.totalAmount), 0);
      if (totalAmount <= 0) {
        throw new AppError('O valor total da fatura deve ser maior que zero.', 400);
      }

      // ── 3. Criar o Contas a Pagar (AccountPayable) ────────────────────────────
      const payable = await tx.accountPayable.create({
        data: {
          organizationId,
          supplierId,
          amount: totalAmount,
          dueDate,
          status: PayableStatus.PENDING,
          notes
        }
      });

      // ── 4. Marcar recibos como BILLED e vinculá-los ao payable ────────────────
      // O where duplo (PENDING) garante proteção contra corrida de processos.
      await tx.materialReceipt.updateMany({
        where: {
          id: { in: receiptIds },
          organizationId,
          status: ReceiptStatus.PENDING
        },
        data: {
          status: ReceiptStatus.BILLED,
          payableId: payable.id
        }
      });

      // ── 5. PARTIDAS DOBRADAS ───────────────────────────────────────────────────
      //
      // Evento: "Recebemos R$ X de insumos do fornecedor e ficamos devendo"
      //
      //   DÉBITO  Estoque de Insumos (Ativo ↑)       ← o bem entrou
      //   CRÉDITO Fornecedores a Pagar (Passivo ↑)   ← a dívida foi assumida
      //
      // Nenhum desses lançamentos é EXPENSE (despesa); a despesa só acontece
      // quando o insumo for consumido na produção (CMV).

      // 5a. DÉBITO – Ativo: Estoque de Insumos (aumenta)
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: stockAccountId,
          type: TransactionType.DEBIT,
          amount: totalAmount,
          description: `Entrada de Estoque – Fatura #${payable.id.slice(-8)}`,
          dueDate,
          status: TransactionStatus.PAID,
          paidAt: new Date(),
          categoryId,
          payableId: payable.id, // Rastreabilidade
          userId,
          profileId: supplierId
        }
      });

      await tx.account.update({
        where: { id: stockAccountId, organizationId },
        data: { balance: { increment: totalAmount } }
      });

      // 5b. CRÉDITO – Passivo: Fornecedores a Pagar (aumenta)
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: supplierAccountId,
          type: TransactionType.CREDIT,
          amount: totalAmount,
          description: `Provisão Fatura Fornecedor #${payable.id.slice(-8)}`,
          dueDate,
          status: TransactionStatus.PENDING,
          categoryId,
          payableId: payable.id, // Rastreabilidade
          userId,
          profileId: supplierId
        }
      });

      await tx.account.update({
        where: { id: supplierAccountId, organizationId },
        data: { balance: { increment: totalAmount } }
      });

      return payable;
    });
  }
}

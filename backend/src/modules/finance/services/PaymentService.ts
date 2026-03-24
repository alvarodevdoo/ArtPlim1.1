import { PrismaClient, PayableStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface PayBillInput {
  organizationId: string;
  payableId: string;
  paymentAccountId: string; // Caixa/Bancos (ativo que sai)
  supplierAccountId: string; // Fornecedores a Pagar (passivo que é baixado)
  paymentMethodId?: string;
  amountPaid: number;
  notes?: string;
  categoryId?: string;
  userId: string;
}

export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Paga uma conta a pagar (AccountPayable), realizando o lançamento
   * de Partidas Dobradas correto para liquidação:
   *
   *   DÉBITO  → Conta de Fornecedores a Pagar (Passivo ↓) – baixa a obrigação
   *   CRÉDITO → Conta Caixa/Banco (Ativo ↓)               – sai dinheiro
   *
   * Desta forma, o lançamento NÃO interfere no DRE (INCOME/EXPENSE),
   * pois trata-se de uma movimentação patrimonial, não de resultado.
   *
   * Regras Estritas:
   * 1. Isolamento Multi-tenant (organizationId em todos os where)
   * 2. Prevenção de Concorrência (status: PENDING no findFirst e update)
   * 3. Rastreabilidade (payableId vinculada a cada Transaction gerada)
   */
  async payBill(input: PayBillInput) {
    const {
      organizationId,
      payableId,
      paymentAccountId,
      supplierAccountId,
      paymentMethodId,
      amountPaid,
      notes,
      categoryId,
      userId
    } = input;

    if (amountPaid <= 0) {
      throw new AppError('O valor pago deve ser maior que zero.', 400);
    }

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. Buscar e validar a Fatura
      const payable = await tx.accountPayable.findFirst({
        where: {
          id: payableId,
          organizationId,
          status: PayableStatus.PENDING
        }
      });

      if (!payable) {
        throw new AppError(
          'Fatura não encontrada, já liquidada ou pertencente a outra organização.',
          404
        );
      }

      if (amountPaid > Number(payable.amount)) {
        throw new AppError('O valor pago não pode ser maior que o valor da fatura.', 400);
      }

      const updatedPayable = await tx.accountPayable.update({
        where: {
          id: payableId,
          organizationId,
          status: PayableStatus.PENDING
        },
        data: {
          status: amountPaid >= Number(payable.amount) ? PayableStatus.PAID : PayableStatus.PENDING,
          notes: notes ? `${payable.notes ?? ''}\nPGTO: ${notes}` : payable.notes
        }
      });

      const today = new Date();

      // ── 2. PARTIDAS DOBRADAS (Auditoria incluída)

      // 2a. DÉBITO – Passivo: Fornecedores a Pagar
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: supplierAccountId,
          type: TransactionType.DEBIT,
          amount: amountPaid,
          description: `Baixa Fatura Fornecedor #${payable.id.slice(-8)}`,
          dueDate: today,
          status: TransactionStatus.PAID,
          paidAt: today,
          categoryId,
          paymentMethodId,
          payableId: payable.id,
          userId,
          profileId: payable.supplierId
        }
      });

      await tx.account.update({
        where: { id: supplierAccountId, organizationId },
        data: { balance: { decrement: amountPaid } }
      });

      // 2b. CRÉDITO – Ativo: Caixa/Banco
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: paymentAccountId,
          type: TransactionType.CREDIT,
          amount: amountPaid,
          description: `Pagamento Fatura Fornecedor #${payable.id.slice(-8)}`,
          dueDate: today,
          status: TransactionStatus.PAID,
          paidAt: today,
          categoryId,
          paymentMethodId,
          payableId: payable.id,
          userId,
          profileId: payable.supplierId
        }
      });

      await tx.account.update({
        where: { id: paymentAccountId, organizationId },
        data: { balance: { decrement: amountPaid } }
      });

      return updatedPayable;
    });
  }
}

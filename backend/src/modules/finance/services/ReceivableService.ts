import { PrismaClient, ReceivableStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface CreateReceivableFromOrderInput {
  organizationId: string;
  customerId: string;
  orderId?: string;
  amount: number;
  dueDate: Date;
  receivableAccountId: string; // Conta de Ativo: Contas a Receber
  revenueAccountId: string;    // Conta de Receita: Vendas / Faturamento
  notes?: string;
  categoryId?: string;
  userId: string; // Operador que realizou a ação
}

export class ReceivableService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Cria uma Conta a Receber a partir de uma venda (Pedido aprovado).
   * Realiza os lançamentos de Partidas Dobradas:
   *
   *   DÉBITO  → Conta de Ativo (Contas a Receber)  – o cliente nos deve
   *   INCOME  → Conta de Receita (Vendas)           – reconhece a receita no DRE
   *
   * O tipo DEBIT não impacta o DRE; o INCOME sim (reconhecimento de receita por competência).
   *
   * Regras Estritas:
   * 1. Isolamento Multi-tenant (organizationId em todos os where)
   * 2. Rastreabilidade (receivableId em cada Transaction gerada)
   */
  async createReceivableFromOrder(input: CreateReceivableFromOrderInput) {
    const {
      organizationId,
      customerId,
      orderId,
      amount,
      dueDate,
      receivableAccountId,
      revenueAccountId,
      notes,
      categoryId,
      userId
    } = input;

    if (amount <= 0) {
      throw new AppError('O valor da conta a receber deve ser maior que zero.', 400);
    }

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. Criar o registro de Conta a Receber ────────────────────────────────
      const receivable = await tx.accountReceivable.create({
        data: {
          organizationId,
          customerId,
          orderId,
          amount,
          dueDate,
          status: ReceivableStatus.PENDING,
          notes
        }
      });

      // ── 2. PARTIDAS DOBRADAS ───────────────────────────────────────────────────
      //
      //   DÉBITO  Contas a Receber (Ativo ↑)
      //   INCOME  Receita de Vendas (Resultado)
      //

      // 2a. DÉBITO – Ativo: Contas a Receber
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: receivableAccountId,
          type: TransactionType.DEBIT,
          amount,
          description: `Conta a Receber – Pedido ${orderId ? '#' + orderId.slice(-8) : 'avulso'}`,
          dueDate,
          status: TransactionStatus.PENDING,
          orderId,
          categoryId,
          receivableId: receivable.id,
          userId, // Quem fez
          profileId: customerId // De quem
        }
      });

      await tx.account.update({
        where: { id: receivableAccountId, organizationId },
        data: { balance: { increment: amount } }
      });

      // 2b. INCOME – Receita de Vendas
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: revenueAccountId,
          type: TransactionType.INCOME,
          amount,
          description: `Receita de Venda – Pedido ${orderId ? '#' + orderId.slice(-8) : 'avulso'}`,
          dueDate,
          status: TransactionStatus.PENDING,
          orderId,
          categoryId,
          receivableId: receivable.id,
          userId, // Quem fez
          profileId: customerId // De quem
        }
      });

      await tx.account.update({
        where: { id: revenueAccountId, organizationId },
        data: { balance: { increment: amount } }
      });

      return receivable;
    });
  }

  /**
   * Lista todas as Contas a Receber da organização.
   * Regra: Isolamento Multi-tenant
   */
  async listReceivables(organizationId: string) {
    return this.prisma.accountReceivable.findMany({
      where: { organizationId },
      include: {
        customer: { select: { id: true, name: true, document: true } },
        order: { select: { id: true, orderNumber: true, total: true } },
        _count: { select: { transactions: true } }
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }]
    });
  }
}

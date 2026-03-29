import { PrismaClient, ReceivableStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface CreateReceivableFromOrderInput {
  organizationId: string;
  customerId: string;
  orderId?: string;
  amount: number;
  dueDate: Date;
  receivableAccountId: string; // Conta de Ativo: Contas a Receber
  splits: {
    revenueAccountId: string;  // Conta de Receita (Vendas/Serviços)
    categoryId: string;        // Categoria Financeira
    amount: number;            // Valor deste rateio
    description?: string;      // Descrição customizada
  }[];
  notes?: string;
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
      splits,
      notes,
      userId
    } = input;

    if (amount <= 0) {
      throw new AppError('O valor da conta a receber deve ser maior que zero.', 400);
    }

    // Validar Soma dos Splits (Regra de Negócio Estrita)
    const splitsTotal = splits.reduce((sum: number, split: any) => sum + split.amount, 0);
    const tolerance = 0.01; // Tolerância para erros de arredondamento de centavos
    if (Math.abs(splitsTotal - amount) > tolerance) {
      throw new AppError(`A soma dos rateios (${splitsTotal}) deve ser igual ao valor total do recebível (${amount}).`, 400);
    }

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. Criar o registro de Conta a Receber (PAI) ───────────────────────────
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

      // ── 2. PARTIDAS DOBRADAS (Master-Detail) ───────────────────────────────────

      // 2a. DÉBITO – Ativo: Contas a Receber (Vontade de receber do cliente)
      // Representa o documento de cobrança único.
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: receivableAccountId,
          type: TransactionType.DEBIT,
          amount,
          description: `Conta a Receber – Pedido ${orderId ? '#' + orderId.slice(-8) : 'avulso'}`,
          dueDate,
          accrualDate: new Date(), // Competência inicial na criação
          status: TransactionStatus.PENDING,
          orderId,
          receivableId: receivable.id,
          userId,
          profileId: customerId
        }
      });

      await tx.account.update({
        where: { id: receivableAccountId, organizationId },
        data: { balance: { increment: amount } }
      });

      // 2b. INCOME – Rateios de Receita (DRE / Competência)
      // Cria um lançamento de receita para cada item do rateio.
      for (const split of splits) {
        await tx.transaction.create({
          data: {
            organizationId,
            accountId: split.revenueAccountId,
            type: TransactionType.INCOME,
            amount: split.amount,
            description: split.description || `Receita de Venda/Serviço – Pedido ${orderId ? '#' + orderId.slice(-8) : 'avulso'}`,
            dueDate,
            accrualDate: new Date(), // Competência inicial na criação
            status: TransactionStatus.PENDING,
            orderId,
            categoryId: split.categoryId,
            receivableId: receivable.id,
            userId,
            profileId: customerId
          }
        });

        await tx.account.update({
          where: { id: split.revenueAccountId, organizationId },
          data: { balance: { increment: split.amount } }
        });
      }

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

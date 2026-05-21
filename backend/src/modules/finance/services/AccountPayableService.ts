import { PrismaClient } from '@prisma/client';

export interface PayableStats {
  overdue: { total: number; count: number };
  upcoming: { total: number; count: number };
  paidThisMonth: { total: number; count: number };
  pendingReceipts: number;
}

export interface GLDefaults {
  stockAccountId: string;
  stockAccountName: string;
  supplierAccountId: string;
  supplierAccountName: string;
}

export class AccountPayableService {
  constructor(private prisma: PrismaClient) {}

  async listPayables(organizationId: string) {
    const payables = await this.prisma.accountPayable.findMany({
      where: { organizationId },
      include: {
        supplier: { select: { id: true, name: true, document: true } },
        _count: { select: { receipts: true } },
        transactions: {
          where: { type: 'CREDIT' },
          select: { accountId: true },
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }]
    });

    return payables.map(({ transactions, ...p }) => ({
      ...p,
      supplierAccountId: transactions[0]?.accountId ?? null
    }));
  }

  async getStats(organizationId: string): Promise<PayableStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [overdue, upcoming, paidThisMonth, pendingReceipts] = await Promise.all([
      this.prisma.accountPayable.aggregate({
        where: { organizationId, status: 'PENDING', dueDate: { lt: now } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.accountPayable.aggregate({
        where: { organizationId, status: 'PENDING', dueDate: { gte: now } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.accountPayable.aggregate({
        where: { organizationId, status: 'PAID', updatedAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.materialReceipt.count({
        where: { organizationId, status: 'PENDING' }
      })
    ]);

    return {
      overdue: { total: Number(overdue._sum.amount ?? 0), count: overdue._count },
      upcoming: { total: Number(upcoming._sum.amount ?? 0), count: upcoming._count },
      paidThisMonth: { total: Number(paidThisMonth._sum.amount ?? 0), count: paidThisMonth._count },
      pendingReceipts
    };
  }

  /**
   * Retorna ou cria as contas contábeis padrão para operações de contas a pagar.
   * O usuário nunca precisa ver ou escolher essas contas — são gerenciadas automaticamente.
   */
  async getGLDefaults(organizationId: string): Promise<GLDefaults> {
    let stockAccount = await this.prisma.account.findFirst({
      where: { organizationId, active: true, name: { contains: 'Estoque', mode: 'insensitive' } }
    });

    if (!stockAccount) {
      stockAccount = await this.prisma.account.create({
        data: { organizationId, name: 'Estoque de Insumos', type: 'CHECKING', balance: 0, active: true }
      });
    }

    let supplierAccount = await this.prisma.account.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { contains: 'Fornecedor', mode: 'insensitive' } },
          { name: { contains: 'a Pagar', mode: 'insensitive' } }
        ]
      }
    });

    if (!supplierAccount) {
      supplierAccount = await this.prisma.account.create({
        data: { organizationId, name: 'Fornecedores a Pagar', type: 'CHECKING', balance: 0, active: true }
      });
    }

    return {
      stockAccountId: stockAccount.id,
      stockAccountName: stockAccount.name,
      supplierAccountId: supplierAccount.id,
      supplierAccountName: supplierAccount.name
    };
  }
}

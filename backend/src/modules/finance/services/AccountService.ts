import { AccountType } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreateAccountInput {
  organizationId: string;
  name: string;
  type: AccountType;
  balance: number;
  bank?: string;
  agency?: string;
  accountNumber?: string;
}

export class AccountService {
  constructor(private prisma: any) {}

  async create(data: CreateAccountInput) {
    const account = await this.prisma.account.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        type: data.type,
        balance: data.balance,
        bank: data.bank,
        agency: data.agency,
        accountNumber: data.accountNumber
      }
    });

    return account;
  }

  async list(organizationId: string) {
    return this.prisma.account.findMany({
      where: {
        organizationId,
        active: true
      },
      include: {
        _count: {
          select: {
            transactions: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findById(id: string, organizationId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, organizationId },
      include: {
        transactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      }
    });

    if (!account) {
      throw new NotFoundError('Conta');
    }

    return account;
  }

  async update(id: string, organizationId: string, data: Partial<CreateAccountInput>) {
    const account = await this.prisma.account.updateMany({
      where: { id, organizationId },
      data
    });
    return this.findById(id, organizationId);
  }

  async updateBalance(id: string, organizationId: string, amount: number, operation: 'ADD' | 'SUBTRACT') {
    const account = await this.findById(id, organizationId);
    
    let newBalance = Number(account.balance);
    
    if (operation === 'ADD') {
      newBalance += amount;
    } else {
      newBalance -= amount;
    }

    const updatedAccount = await this.prisma.account.updateMany({
      where: { id, organizationId },
      data: {
        balance: newBalance
      }
    });

    return this.findById(id, organizationId);
  }

  async getAccountSummary(organizationId: string) {
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        active: true
      },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true
      }
    });

    const totalBalance = accounts.reduce((sum: number, account: any) => {
      return sum + Number(account.balance);
    }, 0);

    const balanceByType = accounts.reduce((acc: any, account: any) => {
      const type = account.type;
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type] += Number(account.balance);
      return acc;
    }, {} as Record<string, number>);

    return {
      accounts,
      totalBalance,
      balanceByType
    };
  }

  async delete(id: string, organizationId: string) {
    // Verificar se existem transações vinculadas a esta conta
    const transactionCount = await this.prisma.transaction.count({
      where: { accountId: id }
    });

    if (transactionCount > 0) {
      // Soft Delete: Apenas desativa a conta para preservar o histórico financeiro
      return this.prisma.account.updateMany({
        where: { id, organizationId },
        data: { active: false }
      });
    }

    // Hard Delete: Se não tem nenhuma transação, pode apagar do banco
    return this.prisma.account.deleteMany({
      where: { id, organizationId }
    });
  }
}
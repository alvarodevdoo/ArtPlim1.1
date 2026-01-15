import { AccountType } from '@prisma/client';
import { NotFoundError } from '../../../@core/errors/AppError';

interface CreateAccountInput {
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

  async list() {
    return this.prisma.account.findMany({
      where: {
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

  async findById(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
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

  async update(id: string, data: Partial<CreateAccountInput>) {
    const account = await this.prisma.account.update({
      where: { id },
      data
    });

    return account;
  }

  async updateBalance(id: string, amount: number, operation: 'ADD' | 'SUBTRACT') {
    const account = await this.findById(id);
    
    let newBalance = Number(account.balance);
    
    if (operation === 'ADD') {
      newBalance += amount;
    } else {
      newBalance -= amount;
    }

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: {
        balance: newBalance
      }
    });

    return updatedAccount;
  }

  async getAccountSummary() {
    const accounts = await this.prisma.account.findMany({
      where: {
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
}
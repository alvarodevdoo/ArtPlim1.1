import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';
import { AccountService } from './AccountService';

interface CreateTransactionInput {
  organizationId: string;
  accountId: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  description: string;
  categoryId?: string;
  orderId?: string;
  dueDate?: string;
  userId?: string;
  profileId?: string;
}

interface TransactionFilters {
  accountId?: string;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export class TransactionService {
  private accountService: AccountService;

  constructor(private prisma: any) {
    this.accountService = new AccountService(prisma);
  }

  async create(data: CreateTransactionInput) {
    const transaction = await this.prisma.transaction.create({
      data: {
        organizationId: data.organizationId,
        accountId: data.accountId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        categoryId: data.categoryId,
        orderId: data.orderId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: 'PENDING',
        userId: data.userId,
        profileId: data.profileId
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        performedBy: {
          select: {
            name: true
          }
        },
        profile: {
          select: {
            name: true
          }
        }
      }
    });

    return transaction;
  }

  async list(organizationId: string, filters: TransactionFilters = {}) {
    const where: any = { organizationId };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return this.prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        performedBy: {
          select: {
            name: true
          }
        },
        profile: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async markAsPaid(id: string, organizationId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, organizationId }
    });

    if (!transaction) {
      throw new NotFoundError('Transação');
    }

    if (transaction.status === 'PAID') {
      throw new Error('Transação já foi paga');
    }

    // Atualizar transação e saldo da conta em transação
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Marcar como paga
      const updatedTransaction = await tx.transaction.updateMany({
        where: { id, organizationId },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });

      // Atualizar saldo da conta
      const operation = transaction.type === 'INCOME' ? 'ADD' : 'SUBTRACT';
      await this.accountService.updateBalance(transaction.accountId, organizationId, Number(transaction.amount), operation);

      return this.prisma.transaction.findFirst({
        where: { id, organizationId },
        include: {
          account: true,
          category: true
        }
      });
    });

    return result;
  }

  async getDashboard(organizationId: string, filters: { startDate?: string; endDate?: string; days?: number } = {}) {
    // Calcular datas se 'days' for fornecido
    let startDate = filters.startDate;
    let endDate = filters.endDate;
    
    if (filters.days) {
      endDate = new Date().toISOString();
      startDate = new Date(Date.now() - (filters.days * 24 * 60 * 60 * 1000)).toISOString();
    }

    const where: any = {
      organizationId,
      status: 'PAID'
    };

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        where.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.paidAt.lte = new Date(endDate);
      }
    }

    const [
      totalIncome,
      totalExpense,
      pendingReceivables,
      pendingPayables,
      accountSummary,
      cashFlowData,
      categoryStats,
      monthlyComparison
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          type: 'INCOME'
        },
        _sum: {
          amount: true
        }
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          type: 'EXPENSE'
        },
        _sum: {
          amount: true
        }
      }),
      this.prisma.transaction.aggregate({
        where: {
          organizationId,
          type: 'INCOME',
          status: 'PENDING'
        },
        _sum: {
          amount: true
        }
      }),
      this.prisma.transaction.aggregate({
        where: {
          organizationId,
          type: 'EXPENSE',
          status: 'PENDING'
        },
        _sum: {
          amount: true
        }
      }),
      this.accountService.getAccountSummary(organizationId),
      this.getCashFlowChart(organizationId, startDate, endDate),
      this.getCategoryStats(organizationId, startDate, endDate),
      this.getMonthlyComparison(organizationId)
    ]);

    const income = Number(totalIncome._sum.amount || 0);
    const expense = Number(totalExpense._sum.amount || 0);
    const profit = income - expense;

    return {
      period: {
        startDate,
        endDate
      },
      summary: {
        totalIncome: income,
        totalExpense: expense,
        profit,
        profitMargin: income > 0 ? (profit / income) * 100 : 0
      },
      pending: {
        receivables: Number(pendingReceivables._sum.amount || 0),
        payables: Number(pendingPayables._sum.amount || 0)
      },
      accounts: accountSummary,
      cashFlow: cashFlowData,
      categoryStats,
      monthlyComparison
    };
  }

  async getCashFlowChart(organizationId: string, startDate?: string, endDate?: string) {
    const where: any = {
      organizationId,
      status: 'PAID'
    };

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        where.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.paidAt.lte = new Date(endDate);
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        type: true,
        amount: true,
        paidAt: true
      },
      orderBy: {
        paidAt: 'asc'
      }
    });

    // Agrupar por data
    const dailyData: Record<string, { income: number; expense: number }> = {};
    
    transactions.forEach((transaction: any) => {
      const date = new Date(transaction.paidAt).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { income: 0, expense: 0 };
      }
      
      const amount = Number(transaction.amount);
      if (transaction.type === 'INCOME') {
        dailyData[date].income += amount;
      } else {
        dailyData[date].expense += amount;
      }
    });

    // Converter para array e calcular saldo acumulado
    let balance = 0;
    return Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        balance += data.income - data.expense;
        return {
          date,
          income: data.income,
          expense: data.expense,
          balance
        };
      });
  }

  async getCategoryStats(organizationId: string, startDate?: string, endDate?: string) {
    const where: any = {
      organizationId,
      status: 'PAID',
      categoryId: { not: null }
    };

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        where.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.paidAt.lte = new Date(endDate);
      }
    }

    const categoryStats = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Buscar informações das categorias
    const categoryIds = [...new Set(categoryStats.map((stat: any) => stat.categoryId))];
    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds }
      },
      select: {
        id: true,
        name: true,
        color: true,
        type: true
      }
    });

    return categoryStats.map((stat: any) => {
      const category = categories.find((cat: any) => cat.id === stat.categoryId);
      return {
        name: category?.name || 'Sem categoria',
        value: Number(stat._sum.amount || 0),
        color: category?.color || '#8884d8',
        type: stat.type,
        count: stat._count.id
      };
    });
  }

  async getMonthlyComparison(organizationId: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [currentMonth, previousMonth] = await Promise.all([
      this.getMonthlyStats(organizationId, currentMonthStart, now),
      this.getMonthlyStats(organizationId, previousMonthStart, previousMonthEnd)
    ]);

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      currentMonth,
      previousMonth,
      growth: {
        income: calculateGrowth(currentMonth.income, previousMonth.income),
        expense: calculateGrowth(currentMonth.expense, previousMonth.expense),
        profit: calculateGrowth(currentMonth.profit, previousMonth.profit)
      }
    };
  }

  async getMonthlyStats(organizationId: string, startDate: Date, endDate: Date) {
    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          organizationId,
          type: 'INCOME',
          status: 'PAID',
          paidAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      }),
      this.prisma.transaction.aggregate({
        where: {
          organizationId,
          type: 'EXPENSE',
          status: 'PAID',
          paidAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      })
    ]);

    const incomeValue = Number(income._sum.amount || 0);
    const expenseValue = Number(expense._sum.amount || 0);

    return {
      income: incomeValue,
      expense: expenseValue,
      profit: incomeValue - expenseValue
    };
  }

  async getCashFlow(organizationId: string, filters: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
  } = {}) {
    const where: any = {
      organizationId,
      status: 'PAID'
    };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.startDate || filters.endDate) {
      where.paidAt = {};
      if (filters.startDate) {
        where.paidAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.paidAt.lte = new Date(filters.endDate);
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        paidAt: true,
        account: {
          select: {
            id: true,
            name: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: {
        paidAt: 'asc'
      }
    });

    // Calcular saldo acumulado
    let runningBalance = 0;
    const cashFlowData = transactions.map((transaction: any) => {
      const amount = Number(transaction.amount);
      const impact = transaction.type === 'INCOME' ? amount : -amount;
      runningBalance += impact;

      return {
        ...transaction,
        impact,
        runningBalance
      };
    });

    return {
      transactions: cashFlowData,
      summary: {
        totalTransactions: transactions.length,
        finalBalance: runningBalance
      }
    };
  }

  async getReceivables(organizationId: string) {
    return this.prisma.transaction.findMany({
      where: {
        organizationId,
        type: 'INCOME',
        status: 'PENDING'
      },
      include: {
        account: {
          select: {
            id: true,
            name: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        performedBy: {
          select: {
            name: true
          }
        },
        profile: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });
  }

  async getPayables(organizationId: string) {
    return this.prisma.transaction.findMany({
      where: {
        organizationId,
        type: 'EXPENSE',
        status: 'PENDING'
      },
      include: {
        account: {
          select: {
            id: true,
            name: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });
  }

  async createFromOrder(orderId: string, organizationId: string, userId?: string) {
    // Buscar pedido
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        customer: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundError('Pedido');
    }

    // Buscar conta padrão (primeira conta ativa)
    const defaultAccount = await this.prisma.account.findFirst({
      where: { active: true, organizationId }
    });

    if (!defaultAccount) {
      throw new Error('Nenhuma conta encontrada para criar a transação');
    }

    // Criar transação de receita
    const transaction = await this.create({
      organizationId,
      accountId: defaultAccount.id,
      type: 'INCOME',
      amount: Number(order.total),
      description: `Venda - Pedido ${order.orderNumber} - ${order.customer.name}`,
      orderId: order.id,
      userId,
      profileId: order.customerId
    });

    return transaction;
  }
}
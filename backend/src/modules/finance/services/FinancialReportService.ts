import { PrismaClient, TransactionType } from '@prisma/client';

export interface DREFilter {
  organizationId: string;
  startDate: Date;
  endDate: Date;
}

export interface CashFlowFilter {
  organizationId: string;
  bankAccountIds: string[];
  startDate: Date;
  endDate: Date;
}

export interface DREResult {
  grossRevenue: number;
  totalExpenses: number;
  netResult: number;
  profitMargin: number;
  incomeByCategory: Array<{ categoryId: string | null; categoryName: string; total: number }>;
  expenseByCategory: Array<{ categoryId: string | null; categoryName: string; total: number }>;
}

export interface CashFlowResult {
  openingBalance: number;
  paidInflows: number;
  paidOutflows: number;
  closingBalance: number;
  projectedInflows: number;
  projectedOutflows: number;
  projectedBalance: number;
  timeline: Array<{
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
    isProjeted: boolean;
  }>;
}

export class FinancialReportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * DRE (Demonstrativo de Resultados) – Regime de Competência.
   *
   * Soma apenas transações do tipo INCOME (Receitas) e EXPENSE (Despesas),
   * ignorando estritamente DEBIT e CREDIT (que são movimentações patrimoniais).
   *
   * Filtra por dueDate dentro do período informado.
   */
  async getDRE(filter: DREFilter): Promise<DREResult> {
    const { organizationId, startDate, endDate } = filter;

    const dateWhere = { gte: startDate, lte: endDate };

    // Agregar receitas por categoria
    const incomeRows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        organizationId,
        type: TransactionType.INCOME,
        dueDate: dateWhere
      },
      _sum: { amount: true }
    });

    // Agregar despesas por categoria
    const expenseRows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        organizationId,
        type: TransactionType.EXPENSE,
        dueDate: dateWhere
      },
      _sum: { amount: true }
    });

    // Buscar nomes de categorias para enriquecer o resultado
    const categoryIds = [
      ...new Set([
        ...incomeRows.map(r => r.categoryId).filter(Boolean),
        ...expenseRows.map(r => r.categoryId).filter(Boolean)
      ])
    ] as string[];

    const categories = categoryIds.length > 0
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds }, organizationId },
          select: { id: true, name: true }
        })
      : [];

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const incomeByCategory = incomeRows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (categoryMap.get(r.categoryId) ?? 'Sem categoria') : 'Sem categoria',
      total: Number(r._sum.amount ?? 0)
    }));

    const expenseByCategory = expenseRows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (categoryMap.get(r.categoryId) ?? 'Sem categoria') : 'Sem categoria',
      total: Number(r._sum.amount ?? 0)
    }));

    const grossRevenue = incomeByCategory.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenseByCategory.reduce((s, r) => s + r.total, 0);
    const netResult = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;

    return { grossRevenue, totalExpenses, netResult, profitMargin, incomeByCategory, expenseByCategory };
  }

  /**
   * Fluxo de Caixa – Regime de Caixa.
   *
   * Opera exclusivamente sobre as contas bancárias informadas (bankAccountIds).
   * Separa movimentos REALIZADOS (paidAt não-nulo, status PAID) de PROJETADOS
   * (dueDate dentro do período, status PENDING).
   *
   * O relatório ignora DEBIT/CREDIT para evitar dupla contagem de provisões.
   */
  async getCashFlow(filter: CashFlowFilter): Promise<CashFlowResult> {
    const { organizationId, bankAccountIds, startDate, endDate } = filter;

    if (bankAccountIds.length === 0) {
      return {
        openingBalance: 0, paidInflows: 0, paidOutflows: 0, closingBalance: 0,
        projectedInflows: 0, projectedOutflows: 0, projectedBalance: 0, timeline: []
      };
    }

    // ── Saldo inicial das contas (antes do período) ───────────────────────────
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: bankAccountIds }, organizationId },
      select: { balance: true }
    });

    // Movimento já realizados dentro do período
    const paidTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        accountId: { in: bankAccountIds },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        status: 'PAID',
        paidAt: { gte: startDate, lte: endDate }
      },
      select: { type: true, amount: true, paidAt: true }
    });

    // Movimentos futuros projetados dentro do período
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        accountId: { in: bankAccountIds },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: startDate, lte: endDate }
      },
      select: { type: true, amount: true, dueDate: true }
    });

    // Saldo atual das contas bancárias como ponto de partida
    const openingBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const paidInflows = paidTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0);

    const paidOutflows = paidTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    const closingBalance = openingBalance + paidInflows - paidOutflows;

    const projectedInflows = pendingTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0);

    const projectedOutflows = pendingTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    const projectedBalance = closingBalance + projectedInflows - projectedOutflows;

    // ── Timeline diária ───────────────────────────────────────────────────────
    type TimelineEntry = { date: string; inflow: number; outflow: number; balance: number; isProjeted: boolean };
    const timelineMap = new Map<string, TimelineEntry>();

    for (const t of paidTransactions) {
      const date = t.paidAt!.toISOString().split('T')[0];
      const existing = timelineMap.get(date) ?? { date, inflow: 0, outflow: 0, balance: 0, isProjeted: false };
      if (t.type === TransactionType.INCOME) existing.inflow += Number(t.amount);
      else existing.outflow += Number(t.amount);
      timelineMap.set(date, existing);
    }

    for (const t of pendingTransactions) {
      const date = t.dueDate!.toISOString().split('T')[0];
      const existing = timelineMap.get(date) ?? { date, inflow: 0, outflow: 0, balance: 0, isProjeted: true };
      if (t.type === TransactionType.INCOME) existing.inflow += Number(t.amount);
      else existing.outflow += Number(t.amount);
      existing.isProjeted = true;
      timelineMap.set(date, existing);
    }

    // Calcular saldo acumulado na timeline
    let runningBalance = openingBalance;
    const timeline = [...timelineMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(entry => {
        runningBalance += entry.inflow - entry.outflow;
        return { ...entry, balance: runningBalance };
      });

    return {
      openingBalance, paidInflows, paidOutflows, closingBalance,
      projectedInflows, projectedOutflows, projectedBalance, timeline
    };
  }
}

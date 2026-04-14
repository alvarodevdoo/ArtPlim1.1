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
  constructor(private prisma: PrismaClient) { }

  /**
   * DRE (Demonstrativo de Resultados) – Regime de Competência.
   * 
   * - RECEITA: Valor total dos Pedidos (Orders) finalizados no período (finishedAt).
   * - CUSTOS (CPV/CMV): Soma do costPrice * quantity dos itens dos pedidos finalizados.
   * - DESPESAS FIXAS: Transações de EXPENSE filtradas por competenceDate.
   */
  async generateDreReport(filter: DREFilter): Promise<DREResult> {
    const { organizationId, startDate, endDate } = filter;
    const dateWhere = { gte: startDate, lte: endDate };

    // 1. Receita de Competência: Pedidos Finalizados/Entregues
    const finishedOrders = await this.prisma.order.findMany({
      where: {
        organizationId,
        finishedAt: dateWhere,
        status: { not: 'CANCELLED' }
      },
      select: {
        total: true,
        items: {
          select: {
            costPrice: true,
            quantity: true
          }
        }
      }
    });

    const grossRevenue = finishedOrders.reduce((acc, order) => acc + Number(order.total), 0);
    
    // 2. Cálculo do CMV (Custo de Mercadoria Vendida)
    let totalCMV = 0;
    finishedOrders.forEach(order => {
      order.items.forEach(item => {
        totalCMV += Number(item.costPrice || 0) * (Number(item.quantity) || 1);
      });
    });

    // 3. Demais Transações de Resultado (Competência)
    const competenceTransactions = await (this.prisma.transaction as any).findMany({
      where: {
        organizationId,
        competenceDate: dateWhere,
        // Ignoramos INCOME com orderId para não duplicar a Receita Bruta (que vem dos pedidos finalizados)
        NOT: {
          AND: [
            { type: TransactionType.INCOME },
            { orderId: { not: null } }
          ]
        }
      },
      include: { category: true }
    });

    const incomeByCategoryMap = new Map<string, { categoryId: string | null, categoryName: string, total: number }>();
    const expenseByCategoryMap = new Map<string, { categoryId: string | null, categoryName: string, total: number }>();

    // Carrega todas as categorias cadastradas para garantir que apareçam no DRE, mesmo com saldo zerado
    const allCategories = await this.prisma.category.findMany({
      where: { organizationId },
      select: { id: true, name: true, type: true }
    });

    allCategories.forEach(cat => {
      if (cat.type === 'INCOME') {
        incomeByCategoryMap.set(cat.id, { categoryId: cat.id, categoryName: cat.name, total: 0 });
      } else if (cat.type === 'EXPENSE') {
        expenseByCategoryMap.set(cat.id, { categoryId: cat.id, categoryName: cat.name, total: 0 });
      }
    });

    // Vendas de Pedidos (Receita Bruta Base)
    incomeByCategoryMap.set('vendas_pedidos', { 
      categoryId: null, 
      categoryName: 'Vendas de Produtos/Serviços', 
      total: grossRevenue 
    });

    // CMV (Custo Base)
    if (totalCMV > 0) {
      expenseByCategoryMap.set('cmv', { 
        categoryId: null, 
        categoryName: 'Custo de Produção (CMV)', 
        total: totalCMV 
      });
    }

    // Processar transações manuais (Despesas fixas, outras receitas, etc.)
    (competenceTransactions as any[]).forEach(tx => {
      const catId = tx.categoryId || 'sem_categoria';
      const catName = tx.category?.name || 'Sem Categoria';
      const amount = Number(tx.amount);

      if (tx.type === TransactionType.INCOME) {
        const existing = incomeByCategoryMap.get(catId) || { categoryId: tx.categoryId, categoryName: catName, total: 0 };
        existing.total += amount;
        incomeByCategoryMap.set(catId, existing);
      } else {
        const existing = expenseByCategoryMap.get(catId) || { categoryId: tx.categoryId, categoryName: catName, total: 0 };
        existing.total += amount;
        expenseByCategoryMap.set(catId, existing);
      }
    });

    const incomeByCategory = Array.from(incomeByCategoryMap.values()).sort((a, b) => b.total - a.total);
    const expenseByCategory = Array.from(expenseByCategoryMap.values()).sort((a, b) => b.total - a.total);
    
    const totalIncome = incomeByCategory.reduce((acc, curr) => acc + curr.total, 0);
    const totalExpenses = expenseByCategory.reduce((acc, curr) => acc + curr.total, 0);
    
    const netResult = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0;

    return {
      grossRevenue: totalIncome,
      totalExpenses,
      netResult,
      profitMargin,
      incomeByCategory,
      expenseByCategory
    };
  }

  /**
   * Fluxo de Caixa – Regime de Caixa.
   * 
   * Considera apenas transações PAID, filtrando por paidAt.
   * Suporta pagamentos parcelados/fracionados naturalmente (cada parcela é uma Transaction).
   */
  async generateCashFlowReport(filter: CashFlowFilter): Promise<CashFlowResult> {
    const { organizationId, bankAccountIds, startDate, endDate } = filter;
    const dateWhere = { gte: startDate, lte: endDate };

    if (bankAccountIds.length === 0) {
      return this.emptyCashFlow();
    }

    // Soma saldo atual das contas
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: bankAccountIds }, organizationId },
      select: { balance: true }
    });
    const currentBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    // Transações Realizadas (Regime de Caixa)
    const paidTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        accountId: { in: bankAccountIds },
        status: 'PAID',
        paidAt: dateWhere
      },
      select: { type: true, amount: true, paidAt: true }
    });

    // Transações Projetadas (A vencer)
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        accountId: { in: bankAccountIds },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: dateWhere
      },
      select: { type: true, amount: true, dueDate: true }
    });

    const paidInflows = paidTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0);

    const paidOutflows = paidTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    // Como o 'currentBalance' no banco reflete o agora, o openingBalance do período
    // precisaria ser calculado retroativamente ou assumido. 
    // Para simplificar e manter compatibilidade com o dashboard:
    const openingBalance = currentBalance - paidInflows + paidOutflows;
    const closingBalance = currentBalance;

    const projectedInflows = pendingTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0);

    const projectedOutflows = pendingTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    const projectedBalance = closingBalance + projectedInflows - projectedOutflows;

    // Timeline
    const timeline = this.buildTimeline(openingBalance, paidTransactions, pendingTransactions);

    return {
      openingBalance,
      paidInflows,
      paidOutflows,
      closingBalance,
      projectedInflows,
      projectedOutflows,
      projectedBalance,
      timeline
    };
  }

  // Métodos de compatibilidade (Legacy alias)
  async getDRE(filter: DREFilter) { return this.generateDreReport(filter); }
  async getCashFlow(filter: CashFlowFilter) { return this.generateCashFlowReport(filter); }

  private buildTimeline(opening: number, paid: any[], pending: any[]) {
    const timelineMap = new Map<string, { date: string, inflow: number, outflow: number, balance: number, isProjeted: boolean }>();

    paid.forEach(t => {
      const date = t.paidAt!.toISOString().split('T')[0];
      const entry = timelineMap.get(date) || { date, inflow: 0, outflow: 0, balance: 0, isProjeted: false };
      if (t.type === TransactionType.INCOME) entry.inflow += Number(t.amount);
      else entry.outflow += Number(t.amount);
      timelineMap.set(date, entry);
    });

    pending.forEach(t => {
      const date = t.dueDate!.toISOString().split('T')[0];
      const entry = timelineMap.get(date) || { date, inflow: 0, outflow: 0, balance: 0, isProjeted: true };
      if (t.type === TransactionType.INCOME) entry.inflow += Number(t.amount);
      else entry.outflow += Number(t.amount);
      entry.isProjeted = true;
      timelineMap.set(date, entry);
    });

    let running = opening;
    return [...timelineMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        running += e.inflow - e.outflow;
        return { ...e, balance: running };
      });
  }

  private emptyCashFlow(): CashFlowResult {
    return {
      openingBalance: 0, paidInflows: 0, paidOutflows: 0, closingBalance: 0,
      projectedInflows: 0, projectedOutflows: 0, projectedBalance: 0, timeline: []
    };
  }
}


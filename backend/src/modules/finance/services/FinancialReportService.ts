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
  grossRevenue: number;         // Soma dos itens de pedidos finalizados
  totalCMV: number;             // Soma dos snapshots de custo dos insumos
  contributionMargin: number;   // grossRevenue - totalCMV
  fixedExpenses: number;        // Transações manuais de saída (EXPENSE)
  netResult: number;            // contributionMargin - fixedExpenses
  profitMargin: number;         // (netResult / grossRevenue) * 100
  incomeByCategory: Array<{ categoryId: string | null; categoryName: string; total: number }>;
  cmvByCategory: Array<{ categoryId: string | null; categoryName: string; total: number }>;
  fixedExpensesByCategory: Array<{ categoryId: string | null; categoryName: string; total: number }>;
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

export interface CNQResult {
  totalWasteCost: number;
  totalOrdersAffected: number;
  pareto: Array<{
    reason: string;
    cost: number;
    occurrences: number;
    percentage: number;
  }>;
}

export class FinancialReportService {
  constructor(private prisma: PrismaClient) { }

  /**
   * DRE (Demonstrativo de Resultados) – Regime de Competência Hierárquico.
   */
  async generateDreReport(filter: DREFilter): Promise<DREResult> {
    const { organizationId, startDate, endDate } = filter;
    const dateWhere = { gte: startDate, lte: endDate };

    // 1. Buscar Pedidos Finalizados e Entregues no período para extrair os itens
    const finishedOrders = await this.prisma.order.findMany({
      where: {
        organizationId,
        finishedAt: dateWhere,
        status: { in: ['FINISHED', 'DELIVERED'] }
      },
      select: {
        id: true,
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    const revenueByCategoryMap = new Map<string, { id: string | null, name: string, total: number }>();
    const cmvByCategoryMap = new Map<string, { id: string | null, name: string, total: number }>();
    
    let grossRevenue = 0;
    let totalCMV = 0;

    // 2. Processar Itens para Receita e CMV (Rastreabilidade via Snapshot)
    finishedOrders.forEach(order => {
      order.items.forEach(item => {
        const itemRevenue = Number(item.totalPrice || 0);
        grossRevenue += itemRevenue;

        // Receita: Agrupada pela categoria do Produto
        const prodCatId = item.product?.categoryId || 'sem_categoria';
        const prodCatName = item.product?.category?.name || 'Vendas (Sem Categoria)';
        
        const existingRev = revenueByCategoryMap.get(prodCatId) || { id: item.product?.categoryId || null, name: prodCatName, total: 0 };
        existingRev.total += itemRevenue;
        revenueByCategoryMap.set(prodCatId, existingRev);

        // CMV: Hierarquia de fallback para garantir custo mesmo em pedidos legados
        // 1º: unitCostAtSale (snapshot da aprovação) × quantidade
        // 2º: costPrice do item (custo manual informado na OS)
        const snapshotCost = Number(item.unitCostAtSale || 0) * (item.quantity || 1);
        const legacyCost   = Number((item as any).costPrice || 0) * (item.quantity || 1);
        const itemCMV = snapshotCost > 0 ? snapshotCost : legacyCost;
        totalCMV += itemCMV;

        let allocatedCMV = 0;

        // Rateio do CMV pelas categorias usando o snapshot, se disponível
        const snapshot = (item as any).compositionSnapshot as any[];
        if (Array.isArray(snapshot) && snapshot.length > 0) {
          snapshot.forEach((line: any) => {
            const lineCost = Number(line.subtotal || 0);
            allocatedCMV += lineCost;

            const matCatId = line.materialCategoryId || 'insumos_diretos';
            const matCatName = line.materialCategory || 'Insumos / Produção';
            
            const existingMat = cmvByCategoryMap.get(matCatId) || { id: line.materialCategoryId || null, name: matCatName, total: 0 };
            existingMat.total += lineCost;
            cmvByCategoryMap.set(matCatId, existingMat);
          });
        }

        // Se o custo real do item for maior que o alocado (ex: custos manuais em terceirizados)
        // ou se não houve snapshot salvo, joga a diferença para uma categoria genérica
        const unallocatedCMV = itemCMV - allocatedCMV;
        if (unallocatedCMV > 0.01) { // margem pequena para arredondamento
          const fallbackCatId = 'custo_manual_diversos';
          const fallbackCatName = 'Custos Operacionais / Terceirizados';
          const existingFallback = cmvByCategoryMap.get(fallbackCatId) || { id: null, name: fallbackCatName, total: 0 };
          existingFallback.total += unallocatedCMV;
          cmvByCategoryMap.set(fallbackCatId, existingFallback);
        }
      });
    });

    // 3. Outras Transações de Resultado (Despesas Fixas e Ingressos Financeiros)
    const finishedOrderIds = finishedOrders.map(o => o.id);
    
    const otherTransactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        OR: [
          { competenceDate: dateWhere },
          { competenceDate: null, createdAt: dateWhere }
        ],
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        // EXCLUSÃO DE DUPLICIDADE: Ignorar INCOME de pedidos finalizados
        NOT: {
          AND: [
            { type: TransactionType.INCOME },
            { orderId: { in: finishedOrderIds } }
          ]
        }
      },
      include: { category: true }
    });

    const fixedExpensesByCategoryMap = new Map<string, { id: string | null, name: string, total: number }>();
    const otherIncomesByCategoryMap = new Map<string, { id: string | null, name: string, total: number }>();
    let fixedExpenses = 0;

    otherTransactions.forEach(tx => {
      const amount = Number(tx.amount);
      const catId = tx.categoryId || 'sem_categoria_fin';
      const catName = tx.category?.name || 'Não Classificado';

      if (tx.type === 'INCOME') {
        const existing = otherIncomesByCategoryMap.get(catId) || { id: tx.categoryId, name: catName, total: 0 };
        existing.total += amount;
        otherIncomesByCategoryMap.set(catId, existing);
        grossRevenue += amount; // Adicionamos outras receitas ao faturamento global
      } else {
        fixedExpenses += amount;
        const existing = fixedExpensesByCategoryMap.get(catId) || { id: tx.categoryId, name: catName, total: 0 };
        existing.total += amount;
        fixedExpensesByCategoryMap.set(catId, existing);
      }
    });

    // 4. Consolidar e Ordenar
    const contributionMargin = grossRevenue - totalCMV;
    const netResult = contributionMargin - fixedExpenses;

    return {
      grossRevenue,
      totalCMV,
      contributionMargin,
      fixedExpenses,
      netResult,
      profitMargin: grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0,
      incomeByCategory: Array.from(revenueByCategoryMap.values()).concat(Array.from(otherIncomesByCategoryMap.values())).sort((a,b) => b.total - a.total),
      cmvByCategory: Array.from(cmvByCategoryMap.values()).sort((a,b) => b.total - a.total),
      fixedExpensesByCategory: Array.from(fixedExpensesByCategoryMap.values()).sort((a,b) => b.total - a.total)
    };
  }

  /**
   * Fluxo de Caixa – Regime de Caixa.
   */
  async generateCashFlowReport(filter: CashFlowFilter): Promise<CashFlowResult> {
    const { organizationId, bankAccountIds, startDate, endDate } = filter;
    const dateWhere = { gte: startDate, lte: endDate };

    if (bankAccountIds.length === 0) return this.emptyCashFlow();

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: bankAccountIds }, organizationId },
      select: { balance: true }
    });
    const currentBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const paidTransactions = await this.prisma.transaction.findMany({
      where: { organizationId, accountId: { in: bankAccountIds }, status: 'PAID', paidAt: dateWhere },
      select: { type: true, amount: true, paidAt: true }
    });

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: { organizationId, accountId: { in: bankAccountIds }, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: dateWhere },
      select: { type: true, amount: true, dueDate: true }
    });

    const paidInflows = paidTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + Number(t.amount), 0);
    const paidOutflows = paidTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + Number(t.amount), 0);
    const openingBalance = currentBalance - paidInflows + paidOutflows;

    return {
      openingBalance,
      paidInflows,
      paidOutflows,
      closingBalance: currentBalance,
      projectedInflows: pendingTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + Number(t.amount), 0),
      projectedOutflows: pendingTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + Number(t.amount), 0),
      projectedBalance: currentBalance + (pendingTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + Number(t.amount), 0)) - (pendingTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + Number(t.amount), 0)),
      timeline: this.buildTimeline(openingBalance, paidTransactions, pendingTransactions)
    };
  }

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
    return [...timelineMap.values()].sort((a,b) => a.date.localeCompare(b.date)).map(e => {
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

  /**
   * Custo da Não Qualidade (CNQ)
   * Lê todos os snapshots do período e extrai apenas a verba de REWORK_WASTE.
   * Agrupa pelo rótulo do motivo gerando dados para o Gráfico de Pareto.
   */
  async generateCnqReport(filter: DREFilter): Promise<CNQResult> {
    const { organizationId, startDate, endDate } = filter;
    
    // Pegamos todos os itens de pedidos confirmados no período
    const finishedOrders = await this.prisma.order.findMany({
      where: {
        organizationId,
        finishedAt: { gte: startDate, lte: endDate },
        status: { in: ['FINISHED', 'DELIVERED'] }
      },
      include: { items: true }
    });

    const reasonsMap = new Map<string, { cost: number; occurrences: number }>();
    let totalWasteCost = 0;
    const affectedOrders = new Set<string>();

    for (const order of finishedOrders) {
      for (const item of order.items) {
        if (!item.compositionSnapshot) continue;

        let snapshot: any[] = [];
        try {
          snapshot = Array.isArray(item.compositionSnapshot)
            ? item.compositionSnapshot
            : JSON.parse(item.compositionSnapshot as string);
        } catch { continue; }

        for (const entry of snapshot) {
          if (entry.source === 'REWORK_WASTE') {
            const reasonLabel = (entry.optionLabel || '').replace('PERDA: ', '').trim() || 'Motivo Não Especificado';
            const cost = Number(entry.subtotal || 0);

            totalWasteCost += cost;
            affectedOrders.add(order.id);

            const existing = reasonsMap.get(reasonLabel) || { cost: 0, occurrences: 0 };
            existing.cost += cost;
            existing.occurrences += 1;
            reasonsMap.set(reasonLabel, existing);
          }
        }
      }
    }

    // Ordenar do maior para o menor custo para formar a ponta do Pareto
    let pareto = Array.from(reasonsMap.entries()).map(([reason, data]) => ({
      reason,
      cost: data.cost,
      occurrences: data.occurrences,
      percentage: totalWasteCost > 0 ? (data.cost / totalWasteCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    return {
      totalWasteCost,
      totalOrdersAffected: affectedOrders.size,
      pareto
    };
  }
}

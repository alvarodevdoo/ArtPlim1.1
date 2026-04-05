import { Decimal } from '@prisma/client/runtime/library';

/**
 * ProfitAnalyticsService
 * 
 * Responsabilidade: Cérebro Analítico (BI). Calcula a rentabilidade real
 * cruzando snapshots de venda com markups alvo dos produtos.
 */
export class ProfitAnalyticsService {
  constructor(private readonly prisma: any) {}

  /**
   * Retorna o relatório detalhado de rentabilidade real vs esperada.
   * Identifica desvios de margem (Vendas Não Saudáveis).
   */
  async getProfitabilityReport(options: { startDate: Date, endDate: Date, organizationId: string }) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        organizationId: options.organizationId,
        order: {
          status: 'APPROVED',
          confirmedAt: { gte: options.startDate, lte: options.endDate }
        }
      },
      include: {
        order: { select: { orderNumber: true, confirmedAt: true, customer: { select: { name: true } } } },
        product: { select: { name: true, targetMarkup: true } }
      },
      orderBy: { confirmedAt: 'desc' }
    });

    return items.map((item: any) => {
      const unitCost = Number(item.unitCostAtSale || 0);
      const unitPrice = Number(item.unitPriceAtSale || 0);
      const targetMarkup = Number(item.product.targetMarkup || 1.1); // Default safety markup

      // Cálculo de Rentabilidade Real
      const realProfitPerUnit = unitPrice - unitCost;
      const realMarkup = unitCost > 0 ? unitPrice / unitCost : 0;
      
      // Divergência: Markup Real vs Alvo (Ex: 1.5 - 1.8 = -0.3)
      const divergence = realMarkup - targetMarkup;

      return {
        orderNumber: item.order.orderNumber,
        customerName: item.order.customer?.name || 'Cliente Geral',
        productName: item.product.name,
        quantity: item.quantity,
        unitCostAtSale: unitCost,
        unitPriceAtSale: unitPrice,
        realProfitPerUnit: realProfitPerUnit,
        realMarkup: Number(realMarkup.toFixed(2)),
        targetMarkup: targetMarkup,
        divergence: divergence,
        isHealthy: divergence >= -0.05, // Tolerância de 5% de desvio
        confirmedAt: item.order.confirmedAt
      };
    });
  }

  /**
   * Métricas agregadas para o Dashboard de BI.
   */
  async getDashboardMetrics(organizationId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { 
        organizationId,
        order: { status: 'APPROVED' }
      },
      select: {
          unitPriceAtSale: true,
          unitCostAtSale: true,
          profitAtSale: true,
          product: { select: { targetMarkup: true } }
      },
      take: 200 // Limitar estatísticas recentes para performance
    });

    let totalRevenue = 0;
    let totalProfit = 0;
    let avgMarkup = 0;
    let lowMarginAlerts = 0;

    items.forEach((item: any) => {
        const price = Number(item.unitPriceAtSale || 0);
        const cost = Number(item.unitCostAtSale || 0);
        const profit = Number(item.profitAtSale || 0);
        const markup = cost > 0 ? price / cost : 0;
        const target = Number(item.product.targetMarkup || 1.1);

        totalRevenue += price;
        totalProfit += profit;
        if (markup < target * 0.8) lowMarginAlerts++; // Alerta se abaixo de 80% do alvo
    });

    return {
      totalRevenue,
      totalProfit,
      avgMarkup: Number(((totalRevenue / (totalRevenue - totalProfit)) || 0).toFixed(2)),
      lowMarginAlerts,
      itemCount: items.length
    };
  }

  /**
   * Agrupa a lucratividade real por categoria para visibilidade setorial.
   */
  async getProfitByCategory(organizationId: string) {
      const items = await this.prisma.orderItem.findMany({
          where: { 
              organizationId,
              order: { status: 'APPROVED' }
          },
          include: {
              product: { include: { category: true } }
          }
      });

      const categories: Record<string, any> = {};

      items.forEach((item: any) => {
          const categoryName = item.product.category?.name || 'Sem Categoria';
          const revenue = Number(item.unitPriceAtSale || 0);
          const profit = Number(item.profitAtSale || 0);

          if (!categories[categoryName]) {
              categories[categoryName] = { name: categoryName, revenue: 0, profit: 0, margin: 0 };
          }

          categories[categoryName].revenue += revenue;
          categories[categoryName].profit += profit;
      });

      return Object.values(categories).map(cat => ({
          ...cat,
          margin: cat.revenue > 0 ? (cat.profit / cat.revenue) * 100 : 0
      })).sort((a, b) => b.profit - a.profit);
  }
}

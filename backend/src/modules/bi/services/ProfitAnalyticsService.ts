/**
 * ProfitAnalyticsService
 * 
 * Responsabilidade: Fornecer queries analíticas sobre a rentabilidade real dos pedidos,
 * comparando o custo capturado no snapshot com o preço de venda e os alvos de markup.
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface ProfitComparison {
  orderNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitCostAtSale: number;
  unitPriceAtSale: number;
  realProfitPerUnit: number;
  realMarkup: number;
  targetMarkup: number;
  divergence: number; // realMarkup - targetMarkup
  confirmedAt: Date | null;
}

export class ProfitAnalyticsService {
  constructor(private readonly prisma: any) {}

  /**
   * Retorna uma lista de itens vendidos com comparação entre markup real vs esperado.
   * Filtra por período de confirmação (APPROVED).
   */
  async getProfitabilityReport(params: {
    startDate: Date;
    endDate: Date;
    organizationId: string;
  }): Promise<ProfitComparison[]> {
    const { startDate, endDate, organizationId } = params;

    // Buscar itens que foram confirmados no período
    const items = await this.prisma.orderItem.findMany({
      where: {
        organizationId,
        confirmedAt: {
          gte: startDate,
          lte: endDate
        },
        unitCostAtSale: { not: null } // Apenas itens com snapshot
      },
      include: {
        order: {
          select: { orderNumber: true, customer: { select: { name: true } } }
        },
        product: {
          select: { name: true, targetMarkup: true, markup: true }
        }
      },
      orderBy: { confirmedAt: 'desc' }
    });

    return items.map((item: any) => {
      const unitCost = Number(item.unitCostAtSale || 0);
      const unitPrice = Number(item.unitPriceAtSale || 0);
      const profitPerUnit = Number(item.profitAtSale || 0);
      
      const realMarkup = unitCost > 0 ? (unitPrice / unitCost) : 0;
      const targetMarkup = item.product.targetMarkup || item.product.markup || 2.0;

      return {
        orderNumber: item.order.orderNumber,
        customerName: item.order.customer.name,
        productName: item.product.name,
        quantity: item.quantity,
        unitCostAtSale: unitCost,
        unitPriceAtSale: unitPrice,
        realProfitPerUnit: profitPerUnit,
        realMarkup: Number(realMarkup.toFixed(2)),
        targetMarkup: Number(targetMarkup.toFixed(2)),
        divergence: Number((realMarkup - targetMarkup).toFixed(2)),
        confirmedAt: item.confirmedAt
      };
    });
  }

  /**
   * Retorna métricas agregadas de BI para o Dashboard.
   */
  async getDashboardMetrics(organizationId: string) {
    // Pegar dados dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const report = await this.getProfitabilityReport({ startDate, endDate, organizationId });

    const totalRevenue = report.reduce((sum, item) => sum + (item.unitPriceAtSale * item.quantity), 0);
    const totalProfit = report.reduce((sum, item) => sum + (item.realProfitPerUnit * item.quantity), 0);
    const avgMarkup = report.length > 0 
      ? report.reduce((sum, item) => sum + item.realMarkup, 0) / report.length 
      : 0;
    
    // Itens com "Prejuízo" ou "Margem Baixa" (Divergência < -0.2)
    const lowMarginAlerts = report.filter(item => item.divergence < -0.2).length;

    return {
      totalRevenue,
      totalProfit,
      avgMarkup: Number(avgMarkup.toFixed(2)),
      lowMarginAlerts,
      itemCount: report.length
    };
  }
}

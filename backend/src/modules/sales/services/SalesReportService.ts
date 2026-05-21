import { PrismaClient } from '@prisma/client';

export interface SalesReportFilter {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  /** Quando informado, restringe todos os agregados a pedidos deste vendedor */
  sellerId?: string;
}

export interface SalesReportResult {
  summary: {
    totalSales: number;
    totalOrders: number;
    avgTicket: number;
    growthSales: number;
    growthOrders: number;
  };
  byStatus: Array<{ status: string; count: number; value: number }>;
  timeline: Array<{ date: string; sales: number; orders: number }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orders: number;
    revenue: number;
  }>;
  topSellers: Array<{
    sellerId: string;
    sellerName: string;
    orders: number;
    revenue: number;
    avgTicket: number;
  }>;
  /** Lista de vendedores com pedidos no período — alimenta o filtro no frontend */
  availableSellers: Array<{ sellerId: string; sellerName: string }>;
}

/**
 * Serviço responsável por gerar agregações analíticas de vendas/pedidos.
 * Considera apenas pedidos não-cancelados para os cálculos de receita,
 * mas mantém o status CANCELLED visível na distribuição por status.
 */
export class SalesReportService {
  constructor(private prisma: PrismaClient) {}

  async generate(filter: SalesReportFilter): Promise<SalesReportResult> {
    const { organizationId, startDate, endDate, sellerId } = filter;
    const periodDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000),
    );

    // Período anterior equivalente para cálculo de crescimento
    const prevStart = new Date(startDate.getTime() - periodDays * 86_400_000);
    const prevEnd = new Date(startDate.getTime() - 1);

    const [currentOrders, previousOrders, availableSellers] = await Promise.all([
      this.fetchOrders(organizationId, startDate, endDate, sellerId),
      this.fetchOrdersAggregate(organizationId, prevStart, prevEnd, sellerId),
      this.fetchAvailableSellers(organizationId, startDate, endDate),
    ]);

    return {
      summary: this.buildSummary(currentOrders, previousOrders),
      byStatus: this.buildStatusDistribution(currentOrders),
      timeline: this.buildTimeline(currentOrders, startDate, endDate),
      topProducts: this.buildTopProducts(currentOrders),
      topCustomers: this.buildTopCustomers(currentOrders),
      topSellers: this.buildTopSellers(currentOrders),
      availableSellers,
    };
  }

  private async fetchOrders(
    organizationId: string,
    start: Date,
    end: Date,
    sellerId?: string,
  ) {
    return this.prisma.order.findMany({
      where: {
        organizationId,
        createdAt: { gte: start, lte: end },
        ...(sellerId ? { sellerId } : {}),
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        customerId: true,
        customer: { select: { name: true } },
        sellerId: true,
        seller: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            totalPrice: true,
            productId: true,
            product: { select: { name: true } },
          },
        },
      },
    });
  }

  private async fetchOrdersAggregate(
    organizationId: string,
    start: Date,
    end: Date,
    sellerId?: string,
  ) {
    return this.prisma.order.findMany({
      where: {
        organizationId,
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
        ...(sellerId ? { sellerId } : {}),
      },
      select: { total: true },
    });
  }

  /**
   * Vendedores distintos com pedidos no período (independente do filtro ativo).
   * Usado para popular o dropdown no frontend sem o filtro se restringir a si mesmo.
   */
  private async fetchAvailableSellers(organizationId: string, start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        createdAt: { gte: start, lte: end },
        sellerId: { not: null },
      },
      select: {
        sellerId: true,
        seller: { select: { name: true } },
      },
      distinct: ['sellerId'],
    });

    return orders
      .filter(o => o.sellerId && o.seller)
      .map(o => ({ sellerId: o.sellerId as string, sellerName: o.seller!.name }))
      .sort((a, b) => a.sellerName.localeCompare(b.sellerName));
  }

  private buildSummary(
    current: Array<{ status: string; total: any }>,
    previous: Array<{ total: any }>,
  ) {
    const valid = current.filter(o => o.status !== 'CANCELLED');
    const totalSales = valid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalOrders = valid.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const prevSales = previous.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const prevOrders = previous.length;

    const growth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      totalSales,
      totalOrders,
      avgTicket,
      growthSales: growth(totalSales, prevSales),
      growthOrders: growth(totalOrders, prevOrders),
    };
  }

  private buildStatusDistribution(orders: Array<{ status: string; total: any }>) {
    const map = new Map<string, { count: number; value: number }>();
    for (const order of orders) {
      const entry = map.get(order.status) || { count: 0, value: 0 };
      entry.count += 1;
      entry.value += Number(order.total || 0);
      map.set(order.status, entry);
    }
    return Array.from(map.entries())
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.value - a.value);
  }

  private buildTimeline(
    orders: Array<{ status: string; total: any; createdAt: Date }>,
    start: Date,
    end: Date,
  ) {
    const map = new Map<string, { sales: number; orders: number }>();

    // Preenche todos os dias do período com zero
    const cursor = new Date(start);
    while (cursor <= end) {
      map.set(cursor.toISOString().split('T')[0], { sales: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of orders) {
      if (order.status === 'CANCELLED') continue;
      const key = order.createdAt.toISOString().split('T')[0];
      const entry = map.get(key) || { sales: 0, orders: 0 };
      entry.sales += Number(order.total || 0);
      entry.orders += 1;
      map.set(key, entry);
    }

    return Array.from(map.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildTopProducts(
    orders: Array<{
      status: string;
      items: Array<{
        quantity: number;
        totalPrice: any;
        productId: string | null;
        product: { name: string } | null;
      }>;
    }>,
  ) {
    const map = new Map<string, { productName: string; quantity: number; revenue: number }>();

    for (const order of orders) {
      if (order.status === 'CANCELLED') continue;
      for (const item of order.items) {
        if (!item.productId) continue;
        const entry = map.get(item.productId) || {
          productName: item.product?.name || 'Produto removido',
          quantity: 0,
          revenue: 0,
        };
        entry.quantity += item.quantity || 0;
        entry.revenue += Number(item.totalPrice || 0);
        map.set(item.productId, entry);
      }
    }

    return Array.from(map.entries())
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private buildTopCustomers(
    orders: Array<{
      status: string;
      total: any;
      customerId: string | null;
      customer: { name: string } | null;
    }>,
  ) {
    const map = new Map<string, { customerName: string; orders: number; revenue: number }>();

    for (const order of orders) {
      if (order.status === 'CANCELLED' || !order.customerId) continue;
      const entry = map.get(order.customerId) || {
        customerName: order.customer?.name || 'Cliente removido',
        orders: 0,
        revenue: 0,
      };
      entry.orders += 1;
      entry.revenue += Number(order.total || 0);
      map.set(order.customerId, entry);
    }

    return Array.from(map.entries())
      .map(([customerId, data]) => ({ customerId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private buildTopSellers(
    orders: Array<{
      status: string;
      total: any;
      sellerId: string | null;
      seller: { name: string } | null;
    }>,
  ) {
    const map = new Map<string, { sellerName: string; orders: number; revenue: number }>();

    for (const order of orders) {
      if (order.status === 'CANCELLED' || !order.sellerId) continue;
      const entry = map.get(order.sellerId) || {
        sellerName: order.seller?.name || 'Vendedor removido',
        orders: 0,
        revenue: 0,
      };
      entry.orders += 1;
      entry.revenue += Number(order.total || 0);
      map.set(order.sellerId, entry);
    }

    return Array.from(map.entries())
      .map(([sellerId, data]) => ({
        sellerId,
        ...data,
        avgTicket: data.orders > 0 ? data.revenue / data.orders : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }
}

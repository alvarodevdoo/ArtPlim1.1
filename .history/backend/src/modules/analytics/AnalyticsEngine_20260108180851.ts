import { PrismaClient } from '@prisma/client';
import { CacheService } from '../../shared/infrastructure/cache/CacheService';

export interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  productIds?: string[];
  customerIds?: string[];
}

export interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    deliveredOrders: number;
    deliveredRevenue: number;
    conversionRate: number;
  };
  sales: {
    date: string;
    revenue: number;
    orderCount: number;
  }[];
  costs: {
    productName: string;
    totalRevenue: number;
    totalMargin: number;
    marginPercentage: number;
  }[];
  materials: {
    materialName: string;
    theoreticalConsumption: number;
    estimatedConsumption: number;
    wastePercentage: number;
    wasteCost: number;
  }[];
  topProducts: {
    productName: string;
    revenue: number;
    margin: number;
    marginPercentage: number;
  }[];
  recentOrders: {
    orderNumber: string;
    customerName: string;
    status: string;
    total: number;
    createdAt: Date;
  }[];
  generatedAt: Date;
}

export interface SalesMetrics {
  date: Date;
  orderCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  deliveredCount: number;
  deliveredRevenue: number;
}

export interface CostAnalysis {
  organizationId: string;
  productId: string;
  productName: string;
  month: Date;
  itemCount: number;
  totalQuantity: number;
  totalCost: number;
  totalRevenue: number;
  totalMargin: number;
  avgMarginPercentage: number;
}

export interface MaterialAnalysis {
  organizationId: string;
  materialId: string;
  materialName: string;
  materialFormat: string;
  month: Date;
  usageCount: number;
  theoreticalConsumption: number;
  estimatedConsumption: number;
  avgWastePercentage: number;
  wasteCost: number;
}

export class AnalyticsEngine {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  async generateDashboardData(
    organizationId: string,
    filters: DashboardFilters
  ): Promise<DashboardData> {
    const cacheKey = this.generateCacheKey('dashboard', organizationId, filters);
    
    // Tentar buscar do cache primeiro
    const cached = await this.cacheService.get<DashboardData>(cacheKey);
    if (cached) return cached;
    
    // Gerar dados se não estiver em cache
    const data = await this.computeDashboardMetrics(organizationId, filters);
    
    // Cachear por 5 minutos
    await this.cacheService.set(cacheKey, data, 300);
    
    return data;
  }

  private async computeDashboardMetrics(
    organizationId: string,
    filters: DashboardFilters
  ): Promise<DashboardData> {
    const { startDate, endDate } = filters;
    
    // Executar queries em paralelo para performance
    const [
      salesMetrics,
      costAnalysis,
      materialMetrics,
      topProducts,
      recentOrders
    ] = await Promise.all([
      this.getSalesMetrics(organizationId, startDate, endDate),
      this.getCostAnalysis(organizationId, startDate, endDate),
      this.getMaterialMetrics(organizationId, startDate, endDate),
      this.getTopProducts(organizationId, startDate, endDate),
      this.getRecentOrders(organizationId, 10)
    ]);

    // Calcular KPIs
    const totalRevenue = salesMetrics.reduce((sum, s) => sum + Number(s.totalRevenue), 0);
    const totalOrders = salesMetrics.reduce((sum, s) => sum + Number(s.orderCount), 0);
    const deliveredRevenue = salesMetrics.reduce((sum, s) => sum + Number(s.deliveredRevenue), 0);
    const deliveredOrders = salesMetrics.reduce((sum, s) => sum + Number(s.deliveredCount), 0);
    
    const kpis = {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      deliveredOrders,
      deliveredRevenue,
      conversionRate: totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0
    };

    return {
      kpis,
      sales: salesMetrics.map(s => ({
        date: s.date.toISOString().split('T')[0],
        revenue: Number(s.totalRevenue),
        orderCount: Number(s.orderCount)
      })),
      costs: costAnalysis.map(c => ({
        productName: c.productName,
        totalRevenue: Number(c.totalRevenue),
        totalMargin: Number(c.totalMargin),
        marginPercentage: Number(c.avgMarginPercentage)
      })),
      materials: materialMetrics.map(m => ({
        materialName: m.materialName,
        theoreticalConsumption: Number(m.theoreticalConsumption),
        estimatedConsumption: Number(m.estimatedConsumption),
        wastePercentage: Number(m.avgWastePercentage),
        wasteCost: Number(m.wasteCost)
      })),
      topProducts: topProducts.slice(0, 5),
      recentOrders,
      generatedAt: new Date()
    };
  }

  private async getSalesMetrics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SalesMetrics[]> {
    const result = await this.prisma.$queryRaw<SalesMetrics[]>`
      SELECT 
        date,
        order_count as "orderCount",
        total_revenue as "totalRevenue",
        avg_order_value as "avgOrderValue",
        delivered_count as "deliveredCount",
        delivered_revenue as "deliveredRevenue"
      FROM "SalesMetrics" 
      WHERE "organizationId" = ${organizationId}
        AND date BETWEEN ${startDate} AND ${endDate}
      ORDER BY date ASC
    `;
    
    return result;
  }

  private async getCostAnalysis(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostAnalysis[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        "organizationId",
        "productId",
        product_name as "productName",
        month,
        item_count as "itemCount",
        total_quantity as "totalQuantity",
        total_cost as "totalCost",
        total_revenue as "totalRevenue",
        total_margin as "totalMargin",
        avg_margin_percentage as "avgMarginPercentage"
      FROM "CostAnalysis" 
      WHERE "organizationId" = ${organizationId}
        AND month BETWEEN date_trunc('month', ${startDate}) 
        AND date_trunc('month', ${endDate})
      ORDER BY total_revenue DESC
    `;
    
    // Converter BigInt para Number
    return result.map(row => ({
      ...row,
      itemCount: Number(row.itemCount),
      totalQuantity: Number(row.totalQuantity),
      totalCost: Number(row.totalCost),
      totalRevenue: Number(row.totalRevenue),
      totalMargin: Number(row.totalMargin),
      avgMarginPercentage: Number(row.avgMarginPercentage)
    }));
  }

  private async getMaterialMetrics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MaterialAnalysis[]> {
    const result = await this.prisma.$queryRaw<MaterialAnalysis[]>`
      SELECT 
        "organizationId",
        "materialId",
        material_name as "materialName",
        material_format as "materialFormat",
        month,
        usage_count as "usageCount",
        theoretical_consumption as "theoreticalConsumption",
        estimated_consumption as "estimatedConsumption",
        avg_waste_percentage as "avgWastePercentage",
        waste_cost as "wasteCost"
      FROM "MaterialAnalysis" 
      WHERE "organizationId" = ${organizationId}
        AND month BETWEEN date_trunc('month', ${startDate}) 
        AND date_trunc('month', ${endDate})
      ORDER BY waste_cost DESC
    `;
    
    return result;
  }

  private async getTopProducts(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const result = await this.prisma.$queryRaw`
      SELECT 
        product_name as "productName",
        SUM(total_revenue) as revenue,
        SUM(total_margin) as margin,
        AVG(avg_margin_percentage) as "marginPercentage"
      FROM "CostAnalysis" 
      WHERE "organizationId" = ${organizationId}
        AND month BETWEEN date_trunc('month', ${startDate}) 
        AND date_trunc('month', ${endDate})
      GROUP BY product_name
      ORDER BY SUM(total_revenue) DESC
      LIMIT 10
    `;
    
    return result.map((r: any) => ({
      productName: r.productName,
      revenue: Number(r.revenue),
      margin: Number(r.margin),
      marginPercentage: Number(r.marginPercentage)
    }));
  }

  private async getRecentOrders(
    organizationId: string,
    limit: number = 10
  ): Promise<any[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId
      },
      include: {
        customer: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return orders.map(order => ({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt
    }));
  }

  async getCostAnalysisReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostAnalysis[]> {
    const cacheKey = this.generateCacheKey('cost-analysis', organizationId, { startDate, endDate });
    
    const cached = await this.cacheService.get<CostAnalysis[]>(cacheKey);
    if (cached) return cached;
    
    const data = await this.getCostAnalysis(organizationId, startDate, endDate);
    
    // Cache por 1 hora
    await this.cacheService.set(cacheKey, data, 3600);
    
    return data;
  }

  async getMaterialAnalysisReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MaterialAnalysis[]> {
    const cacheKey = this.generateCacheKey('material-analysis', organizationId, { startDate, endDate });
    
    const cached = await this.cacheService.get<MaterialAnalysis[]>(cacheKey);
    if (cached) return cached;
    
    const data = await this.getMaterialMetrics(organizationId, startDate, endDate);
    
    // Cache por 1 hora
    await this.cacheService.set(cacheKey, data, 3600);
    
    return data;
  }

  async refreshMaterializedViews(): Promise<void> {
    await this.prisma.$executeRaw`SELECT refresh_analytics_views()`;
    
    // Invalidar cache relacionado
    await this.cacheService.invalidatePattern('analytics:*');
  }

  private generateCacheKey(type: string, organizationId: string, params: any): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    const hash = require('crypto').createHash('md5').update(paramString).digest('hex');
    return `analytics:${type}:${organizationId}:${hash}`;
  }
}
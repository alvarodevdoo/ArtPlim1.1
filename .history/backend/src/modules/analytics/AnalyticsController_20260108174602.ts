import { Request, Response } from 'express';
import { AnalyticsEngine, DashboardFilters } from './AnalyticsEngine';
import { CacheService } from '../../shared/infrastructure/cache/CacheService';
import { prisma } from '../../shared/infrastructure/database/prisma';

export class AnalyticsController {
  private analyticsEngine: AnalyticsEngine;

  constructor() {
    const cacheService = new CacheService();
    this.analyticsEngine = new AnalyticsEngine(prisma, cacheService);
  }

  async getDashboard(req: Request, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { 
        startDate, 
        endDate, 
        productIds, 
        customerIds 
      } = req.query;

      // Validar e converter datas
      const filters: DashboardFilters = {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
        endDate: endDate ? new Date(endDate as string) : new Date(),
        productIds: productIds ? (productIds as string).split(',') : undefined,
        customerIds: customerIds ? (customerIds as string).split(',') : undefined
      };

      const dashboardData = await this.analyticsEngine.generateDashboardData(
        organizationId,
        filters
      );

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('Erro ao gerar dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  async getCostAnalysis(req: Request, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const costAnalysis = await this.analyticsEngine.getCostAnalysisReport(
        organizationId,
        start,
        end
      );

      res.json({
        success: true,
        data: costAnalysis
      });
    } catch (error) {
      console.error('Erro ao gerar análise de custos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  async getMaterialAnalysis(req: Request, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const materialAnalysis = await this.analyticsEngine.getMaterialAnalysisReport(
        organizationId,
        start,
        end
      );

      res.json({
        success: true,
        data: materialAnalysis
      });
    } catch (error) {
      console.error('Erro ao gerar análise de materiais:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  async refreshViews(req: Request, res: Response) {
    try {
      await this.analyticsEngine.refreshMaterializedViews();

      res.json({
        success: true,
        message: 'Views materializadas atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar views:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  async getKPIs(req: Request, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { period = '30' } = req.query;

      const days = parseInt(period as string);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const filters: DashboardFilters = { startDate, endDate };
      const dashboardData = await this.analyticsEngine.generateDashboardData(
        organizationId,
        filters
      );

      res.json({
        success: true,
        data: {
          kpis: dashboardData.kpis,
          period: days,
          generatedAt: dashboardData.generatedAt
        }
      });
    } catch (error) {
      console.error('Erro ao gerar KPIs:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  async getSalesChart(req: Request, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const filters: DashboardFilters = { startDate: start, endDate: end };
      const dashboardData = await this.analyticsEngine.generateDashboardData(
        organizationId,
        filters
      );

      res.json({
        success: true,
        data: {
          sales: dashboardData.sales,
          groupBy,
          period: { startDate: start, endDate: end }
        }
      });
    } catch (error) {
      console.error('Erro ao gerar gráfico de vendas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}
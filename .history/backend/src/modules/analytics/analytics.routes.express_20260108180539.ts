import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AnalyticsController } from './AnalyticsController.express';

export function createAnalyticsRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const analyticsController = new AnalyticsController(prisma);

  // Dashboard principal
  router.get('/dashboard', analyticsController.getDashboard.bind(analyticsController));

  // KPIs específicos
  router.get('/kpis', analyticsController.getKPIs.bind(analyticsController));

  // Gráfico de vendas
  router.get('/sales-chart', analyticsController.getSalesChart.bind(analyticsController));

  // Análise de custos
  router.get('/cost-analysis', analyticsController.getCostAnalysis.bind(analyticsController));

  // Análise de materiais
  router.get('/material-analysis', analyticsController.getMaterialAnalysis.bind(analyticsController));

  // Atualizar views materializadas
  router.post('/refresh-views', analyticsController.refreshViews.bind(analyticsController));

  return router;
}
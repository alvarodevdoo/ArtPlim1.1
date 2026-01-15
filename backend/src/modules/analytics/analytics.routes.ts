import { FastifyInstance } from 'fastify';
import { AnalyticsController } from './AnalyticsController';

export async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsController = new AnalyticsController();

  // Dashboard principal
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate]
  }, analyticsController.getDashboard.bind(analyticsController));

  // KPIs específicos
  fastify.get('/kpis', {
    preHandler: [fastify.authenticate]
  }, analyticsController.getKPIs.bind(analyticsController));

  // Gráfico de vendas
  fastify.get('/sales-chart', {
    preHandler: [fastify.authenticate]
  }, analyticsController.getSalesChart.bind(analyticsController));

  // Análise de custos
  fastify.get('/cost-analysis', {
    preHandler: [fastify.authenticate]
  }, analyticsController.getCostAnalysis.bind(analyticsController));

  // Análise de materiais
  fastify.get('/material-analysis', {
    preHandler: [fastify.authenticate]
  }, analyticsController.getMaterialAnalysis.bind(analyticsController));

  // Atualizar views materializadas
  fastify.post('/refresh-views', {
    preHandler: [fastify.authenticate]
  }, analyticsController.refreshViews.bind(analyticsController));
}
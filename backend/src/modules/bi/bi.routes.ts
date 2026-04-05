import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ProfitAnalyticsService } from './services/ProfitAnalyticsService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const biRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/metrics', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ProfitAnalyticsService(prisma);
    const metrics = await service.getDashboardMetrics(request.user!.organizationId);
    return reply.send({ success: true, data: metrics });
  });

  fastify.get('/profitability', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ProfitAnalyticsService(prisma);
    
    // Default 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const report = await service.getProfitabilityReport({
      startDate,
      endDate,
      organizationId: request.user!.organizationId
    });

    return reply.send({ success: true, data: report });
  });

  /**
   * NOVO: Agrupamento por Categoria para BI de Alta Performance
   */
  fastify.get('/categories', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ProfitAnalyticsService(prisma);
    const report = await service.getProfitByCategory(request.user!.organizationId);
    return reply.send({ success: true, data: report });
  });
};

export default biRoutes;

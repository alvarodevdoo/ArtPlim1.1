import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { ProfitAnalyticsService } from './services/ProfitAnalyticsService';

const biRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  
  /**
   * GET /api/bi/metrics
   * Retorna métricas agregadas do dashboard de lucros.
   */
  fastify.get('/metrics', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ProfitAnalyticsService(prisma);

    const metrics = await service.getDashboardMetrics(request.user!.organizationId);
    return reply.send({ success: true, data: metrics });
  });

  /**
   * GET /api/bi/profitability
   * Retorna o relatório detalhado de rentabilidade real vs esperada.
   */
  fastify.get('/profitability', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = z.object({
      startDate: z.string().optional().transform(v => v ? new Date(v) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      endDate: z.string().optional().transform(v => v ? new Date(v) : new Date())
    }).parse(request.query);

    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ProfitAnalyticsService(prisma);

    const report = await service.getProfitabilityReport({
      startDate: query.startDate,
      endDate: query.endDate,
      organizationId: request.user!.organizationId
    });

    return reply.send({ success: true, data: report });
  });
};

export default biRoutes;

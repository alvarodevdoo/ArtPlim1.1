import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  status: z.string().optional()
});

const statsQuerySchema = z.object({
  days: z.string().transform(val => parseInt(val) || 30).optional()
});

export async function salesRoutesOptimized(fastify: FastifyInstance) {
  
  // ========== PEDIDOS OTIMIZADOS ==========
  
  // Listar pedidos com QueryOptimizer
  fastify.get('/orders', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const orders = await queryOptimizer.getOptimizedOrders(
      request.user!.organizationId,
      query.limit || 50,
      query.offset || 0
    );
    
    return reply.send({
      success: true,
      data: orders
    });
  });

  // Estatísticas de pedidos otimizadas
  fastify.get('/orders/stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = statsQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (query.days || 30));
    
    const stats = await queryOptimizer.getDashboardStats(
      request.user!.organizationId,
      startDate,
      endDate
    );
    
    return reply.send({
      success: true,
      data: stats
    });
  });
}
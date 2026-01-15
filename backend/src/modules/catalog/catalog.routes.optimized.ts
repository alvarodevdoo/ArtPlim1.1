import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  search: z.string().optional()
});

export async function catalogRoutesOptimized(fastify: FastifyInstance) {
  
  // ========== PRODUTOS OTIMIZADOS ==========
  
  // Listar produtos com QueryOptimizer
  fastify.get('/products', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const products = await queryOptimizer.getOptimizedProducts(
      request.user!.organizationId,
      query.limit || 50,
      query.offset || 0
    );
    
    return reply.send({
      success: true,
      data: products
    });
  });

  // ========== MATERIAIS OTIMIZADOS ==========
  
  // Listar materiais com QueryOptimizer
  fastify.get('/materials', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const materials = await queryOptimizer.getOptimizedMaterials(
      request.user!.organizationId
    );
    
    return reply.send({
      success: true,
      data: materials
    });
  });
}
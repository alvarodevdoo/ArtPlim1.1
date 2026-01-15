import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const listQuerySchema = z.object({
  isCustomer: z.string().transform(val => val === 'true').optional(),
  isEmployee: z.string().transform(val => val === 'true').optional(),
  isSupplier: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional()
});

export async function profilesRoutesOptimized(fastify: FastifyInstance) {
  
  // ========== PERFIS OTIMIZADOS ==========
  
  // Listar perfis com QueryOptimizer
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    // Usar query otimizada baseada no tipo solicitado
    let profiles;
    
    if (query.isCustomer) {
      profiles = await queryOptimizer.getOptimizedCustomers(
        request.user!.organizationId,
        query.limit || 50
      );
    } else if (query.isEmployee) {
      profiles = await queryOptimizer.getOptimizedEmployees(
        request.user!.organizationId,
        query.limit || 50
      );
    } else {
      // Query genérica para todos os perfis
      profiles = await prisma.profile.findMany({
        where: {
          organizationId: request.user!.organizationId,
          ...(query.isSupplier !== undefined && { isSupplier: query.isSupplier }),
          ...(query.search && {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { document: { contains: query.search, mode: 'insensitive' } }
            ]
          })
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          type: true,
          isCustomer: true,
          isSupplier: true,
          isEmployee: true,
          createdAt: true
        },
        take: query.limit || 50,
        orderBy: { name: 'asc' }
      });
    }
    
    return reply.send({
      success: true,
      data: profiles
    });
  });

  // Listar clientes otimizado
  fastify.get('/customers/list', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const customers = await queryOptimizer.getOptimizedCustomers(
      request.user!.organizationId,
      100
    );
    
    return reply.send({
      success: true,
      data: customers
    });
  });

  // Listar funcionários otimizado
  fastify.get('/employees/list', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const employees = await queryOptimizer.getOptimizedEmployees(
      request.user!.organizationId,
      100
    );
    
    return reply.send({
      success: true,
      data: employees
    });
  });
}
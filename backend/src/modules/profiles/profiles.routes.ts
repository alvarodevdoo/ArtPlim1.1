import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { ProfileService } from './services/ProfileService';

const listQuerySchema = z.object({
  isCustomer: z.string().transform(val => val === 'true').optional(),
  isEmployee: z.string().transform(val => val === 'true').optional(),
  isSupplier: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional()
});

const createProfileSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z.string().min(2),
  document: z.string().nullable().transform(val => val?.trim() || undefined),
  email: z.string().nullable().transform(val => val?.trim() || undefined).refine(val => !val || z.string().email().safeParse(val).success, 'Email inv\u00e1lido'),
  phone: z.string().nullable().transform(val => val?.trim() || undefined),
  address: z.string().nullable().transform(val => val?.trim() || undefined),
  city: z.string().nullable().transform(val => val?.trim() || undefined),
  state: z.string().nullable().transform(val => val?.trim() || undefined),
  zipCode: z.string().nullable().transform(val => val?.trim() || undefined),
  isCustomer: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
  isEmployee: z.boolean().default(false),
  creditLimit: z.number().positive().optional(),
  paymentTerms: z.number().int().positive().optional()
});

const updateProfileSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
  name: z.string().min(2).optional(),
  document: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  email: z.string().nullable().transform(val => val?.trim() || undefined).refine(val => !val || z.string().email().safeParse(val).success, 'Email inv\u00e1lido').optional(),
  phone: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  address: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  city: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  state: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  zipCode: z.string().nullable().transform(val => val?.trim() || undefined).optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  isEmployee: z.boolean().optional(),
  creditLimit: z.number().positive().optional(),
  paymentTerms: z.number().int().positive().optional()
});

export async function profilesRoutes(fastify: FastifyInstance) {

  
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
          createdAt: true,
          _count: {
            select: {
              orders: {
                where: { status: { not: 'CANCELLED' } }
              }
            }
          }
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

  // Criar perfil
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = createProfileSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);
      const profileService = new ProfileService(prisma);
      
      const profile = await profileService.create({
        ...body,
        organizationId: request.user!.organizationId
      });
      
      return reply.code(201).send({
        success: true,
        data: profile
      });
    } catch (error: any) {
      fastify.log.error('Erro ao criar perfil:', error);
      
      // Tratar erro de constraint \u00fanica do Prisma
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[1]; // organizationId \u00e9 sempre o primeiro
        const fieldName = field === 'document' ? 'documento' : field === 'email' ? 'email' : 'campo';
        return reply.code(400).send({
          success: false,
          error: {
            message: `Este ${fieldName} j\u00e1 est\u00e1 cadastrado`,
            statusCode: 400
          }
        });
      }
      
      return reply.code(500).send({
        success: false,
        error: {
          message: error.message || 'Erro interno do servidor',
          statusCode: 500
        }
      });
    }
  });

  // Buscar perfil por ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const profile = await profileService.findById(id);
    
    return reply.send({
      success: true,
      data: profile
    });
  });

  // Atualizar perfil
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProfileSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const profile = await profileService.update(id, {
      ...body,
      organizationId: request.user!.organizationId
    });
    
    return reply.send({
      success: true,
      data: profile
    });
  });

  // Remover perfil
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const result = await profileService.delete(id);
    
    return reply.send({
      success: true,
      data: result
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

  // Listar fornecedores
  fastify.get('/suppliers/list', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const suppliers = await profileService.list({ isSupplier: true });
    
    return reply.send({
      success: true,
      data: suppliers
    });
  });
}
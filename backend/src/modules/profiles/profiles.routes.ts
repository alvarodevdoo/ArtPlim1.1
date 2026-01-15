import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProfileService } from './services/ProfileService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const createProfileSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z.string().min(2),
  document: z.string().nullable().transform(val => val?.trim() || undefined),
  email: z.string().nullable().transform(val => val?.trim() || undefined).refine(val => !val || z.string().email().safeParse(val).success, 'Email inválido'),
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
  email: z.string().nullable().transform(val => val?.trim() || undefined).refine(val => !val || z.string().email().safeParse(val).success, 'Email inválido').optional(),
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
  
  // Listar perfis
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const profiles = await profileService.list({
      type: query.type,
      isCustomer: query.isCustomer === 'true',
      isSupplier: query.isSupplier === 'true',
      isEmployee: query.isEmployee === 'true',
      search: query.search
    });
    
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
      
      const profile = await profileService.create(body);
      
      return reply.code(201).send({
        success: true,
        data: profile
      });
    } catch (error: any) {
      fastify.log.error('Erro ao criar perfil:', error);
      
      // Tratar erro de constraint única do Prisma
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[1]; // organizationId é sempre o primeiro
        const fieldName = field === 'document' ? 'documento' : field === 'email' ? 'email' : 'campo';
        return reply.code(400).send({
          success: false,
          error: {
            message: `Este ${fieldName} já está cadastrado`,
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
    
    const profile = await profileService.update(id, body);
    
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

  // Buscar clientes (atalho)
  fastify.get('/customers/list', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const profileService = new ProfileService(prisma);
    
    const customers = await profileService.list({ isCustomer: true });
    
    return reply.send({
      success: true,
      data: customers
    });
  });

  // Buscar fornecedores (atalho)
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
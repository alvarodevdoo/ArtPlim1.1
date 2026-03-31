import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from './services/OrganizationService';
import { UserService } from './services/UserService';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { requireRole } from '../../shared/infrastructure/auth/middleware';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  plan: z.enum(['basic', 'pro', 'enterprise', 'PREMIUM']).optional()
});

const updateSettingsSchema = z.object({
  enableWMS: z.boolean().optional(),
  enableProduction: z.boolean().optional(),
  enableFinance: z.boolean().optional(),
  enableFinanceReports: z.boolean().optional(),
  enableAutomation: z.boolean().optional(),
  defaultMarkup: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  validadeOrcamento: z.number().int().min(1).max(365).optional(),
  allowDuplicatePhones: z.boolean().optional(),
  requireDocumentKeyForEntry: z.boolean().optional(),
  defaultReceivableCategoryId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  defaultRevenueCategoryId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional()
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'USER'])
});

export async function organizationRoutes(fastify: FastifyInstance) {

  // ========== ORGANIZAÇÃO ==========

  // Buscar dados da organização
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const organizationService = new OrganizationService(prisma);

    const organization = await organizationService.findById(request.user!.organizationId);

    return reply.send({
      success: true,
      data: organization
    });
  });

  // Atualizar organização
  fastify.put('/', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const body = updateOrganizationSchema.parse(request.body);
    const organizationService = new OrganizationService(prisma);

    const organization = await organizationService.update(request.user!.organizationId, body);

    return reply.send({
      success: true,
      data: organization
    });
  });

  // ========== CONFIGURAÇÕES ==========

  // Buscar configurações
  fastify.get('/settings', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const organizationService = new OrganizationService(prisma);

    const settings = await organizationService.getSettings(request.user!.organizationId);

    return reply.send({
      success: true,
      data: settings
    });
  });

  // Atualizar configurações
  fastify.put('/settings', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const body = updateSettingsSchema.parse(request.body);
    const organizationService = new OrganizationService(prisma);

    const settings = await organizationService.updateSettings(request.user!.organizationId, body);

    return reply.send({
      success: true,
      data: settings
    });
  });

  // ========== USUÁRIOS ==========

  // Listar usuários da organização
  fastify.get('/users', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const userService = new UserService(prisma);

    const users = await userService.listByOrganization(request.user!.organizationId);

    return reply.send({
      success: true,
      data: users
    });
  });

  // Criar usuário
  fastify.post('/users', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const userService = new UserService(prisma);

    const user = await userService.create({
      ...body,
      organizationId: request.user!.organizationId
    });

    return reply.code(201).send({
      success: true,
      data: user
    });
  });

  // Atualizar usuário
  fastify.put('/users/:id', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createUserSchema.partial().parse(request.body);
    const userService = new UserService(prisma);

    const user = await userService.update(id, request.user!.organizationId, body);

    return reply.send({
      success: true,
      data: user
    });
  });

  // Desativar usuário
  fastify.delete('/users/:id', {
    preHandler: [fastify.authenticate, requireRole(['OWNER', 'ADMIN'])]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userService = new UserService(prisma);

    await userService.deactivate(id, request.user!.organizationId);

    return reply.send({
      success: true,
      message: 'Usuário desativado com sucesso'
    });
  });
}
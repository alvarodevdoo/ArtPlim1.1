import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from './services/OrganizationService';
import { UserService } from './services/UserService';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { requirePermission } from '../../shared/infrastructure/auth/middleware';
import crypto from 'crypto';
import { BackupCryptoService } from '../backup/infrastructure/crypto/BackupCryptoService';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  razaoSocial: z.string().nullable().optional().transform(v => v === '' ? null : v),
  cnpj: z.string().nullable().optional().transform(v => v === '' ? null : v),
  plan: z.enum(['basic', 'pro', 'enterprise', 'PREMIUM']).optional(),
  email: z.string().email().or(z.literal('')).nullable().optional().transform(v => v === '' ? null : v),
  phone: z.string().nullable().optional().transform(v => v === '' ? null : v),
  zipCode: z.string().nullable().optional().transform(v => v === '' ? null : v),
  address: z.string().nullable().optional().transform(v => v === '' ? null : v),
  addressNumber: z.string().nullable().optional().transform(v => v === '' ? null : v),
  complement: z.string().nullable().optional().transform(v => v === '' ? null : v),
  neighborhood: z.string().nullable().optional().transform(v => v === '' ? null : v),
  city: z.string().nullable().optional().transform(v => v === '' ? null : v),
  state: z.string().length(2).or(z.literal('')).nullable().optional().transform(v => v === '' ? null : (v ? v.toUpperCase() : null))
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
  enableCategoryAppropriation: z.boolean().optional(),
  defaultReceivableCategoryId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  defaultRevenueCategoryId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  defaultBackupPassword: z.string().min(6, 'Senha mestre muito curta').or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  recoveryToken: z.string().nullable().optional(),
  defaultSalesUnit: z.string().optional(),
  freightExpenseAccountId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  taxExpenseAccountId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional()
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
    preHandler: [fastify.authenticate, requirePermission(['admin.organization'])]
  }, async (request, reply) => {
    try {
      const body = updateOrganizationSchema.parse(request.body);
      const organizationService = new OrganizationService(prisma);

      const organization = await organizationService.update(request.user!.organizationId, body);

      return reply.send({
        success: true,
        data: organization
      });
    } catch (error: any) {
      console.error('ERRO INTERNO PUT /api/organization:', error);
      return reply.code(500).send({
        success: false,
        message: 'Erro Interno: ' + error.message,
        details: error
      });
    }
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
    preHandler: [fastify.authenticate, requirePermission(['admin.settings'])]
  }, async (request, reply) => {
    try {
      const body = updateSettingsSchema.parse(request.body);
      
      // Criptografa a senha mestre se ela foi enviada no payload, pois é reversível apenas pelo motor do sistema
      if (body.defaultBackupPassword) {
         body.defaultBackupPassword = BackupCryptoService.encryptMasterPassword(body.defaultBackupPassword);
         
         // Se definiu uma nova senha mestre mas não tem token de recuperação, gera um agora
         if (!body.recoveryToken) {
           body.recoveryToken = `REC-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
         }
      } else if (body.defaultBackupPassword === '') {
         body.defaultBackupPassword = null; // Permite o dono remover a senha se quiser exportar livremente
      }

      const organizationService = new OrganizationService(prisma);
      const settings = await organizationService.updateSettings(request.user!.organizationId, body);

      return reply.send({
        success: true,
        data: settings
      });
    } catch (error: any) {
      console.error('ERRO INTERNO PUT /api/organization/settings:', error);
      return reply.code(error.name === 'ZodError' ? 400 : 500).send({
        success: false,
        message: error.message,
        details: error.name === 'ZodError' ? error.errors : undefined
      });
    }
  });

  // ========== USUÁRIOS ==========

  // Listar usuários da organização
  fastify.get('/users', {
    preHandler: [fastify.authenticate, requirePermission(['admin.users'])]
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
    preHandler: [fastify.authenticate, requirePermission(['admin.users'])]
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
    preHandler: [fastify.authenticate, requirePermission(['admin.users'])]
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
    preHandler: [fastify.authenticate, requirePermission(['admin.users'])]
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
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from './services/OrganizationService';
import { UserService } from './services/UserService';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { requirePermission } from '../../shared/infrastructure/auth/middleware';
import crypto from 'crypto';
import forge from 'node-forge';
import { BackupCryptoService } from '../backup/infrastructure/crypto/BackupCryptoService';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  razaoSocial: z.string().nullable().optional().transform(v => v === '' ? null : v),
  cnpj: z.string().nullable().optional().transform(v => v === '' ? null : v),
  plan: z.enum(['basic', 'pro', 'enterprise', 'premium', 'PREMIUM']).optional(),
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
  taxExpenseAccountId: z.string().uuid().or(z.literal('')).nullable().transform(val => val === '' ? null : val).optional(),
  nfeCertificate: z.string().nullable().optional(),
  nfeCertificatePassword: z.string().nullable().optional(),
  nfeCertificateFileName: z.string().nullable().optional(),
  nfeCertificateSubject: z.string().nullable().optional(),
  nfeCertificateExpiry: z.string().nullable().or(z.date()).optional(),
  inventoryValuationMethod: z.string().optional(),
  requireOrderDeposit: z.boolean().optional(),
  minDepositPercent: z.number().min(0).max(100).optional(),
  allowDeliveryWithBalance: z.boolean().optional(),
  defaultDueDateDays: z.number().int().min(0).optional(),
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
      const existingSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId: request.user!.organizationId }
      });
      
      const updateData: any = { ...body };

      // Lógica de Certificado Digital
      if (body.nfeCertificate && body.nfeCertificatePassword) {
        // Se a senha enviada for igual à criptografada existente, pula a re-validação e re-criptografia
        if (body.nfeCertificatePassword !== existingSettings?.nfeCertificatePassword) {
          try {
            // 1. Validar e Extrair Data de Expiração
          const p12Der = forge.util.decode64(body.nfeCertificate);
          const p12Asn1 = forge.asn1.fromDer(p12Der);
          const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, body.nfeCertificatePassword);
          
          let expiryDate: Date | null = null;
          let foundCerts = 0;

          // Busca recursiva de todos os bags de certificado (mesmo aninhados)
          const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
          const bagsArray = certBags[forge.pki.oids.certBag] || [];

          for (const bag of bagsArray) {
            if (bag.cert) {
              foundCerts++;
              const notAfter = bag.cert.validity.notAfter;
              
              // Se for o certificado com a validade MAIS CURTA, assumimos que é o do titular (A1)
              // Certificados de AC duram 5~10 anos, o A1 dura 1 ano.
              if (!expiryDate || notAfter < expiryDate) {
                expiryDate = notAfter;
                
                // Extrair Titular (CN) apenas deste certificado (o de menor validade)
                try {
                  const cnField = bag.cert.subject.getField('CN');
                  if (cnField && cnField.value) {
                    updateData.nfeCertificateSubject = String(cnField.value);
                  } else {
                    updateData.nfeCertificateSubject = bag.cert.subject.attributes?.find((a: any) => a.shortName === 'CN')?.value || 'Certificado Cadastrado';
                  }
                } catch (e) {
                  if (!updateData.nfeCertificateSubject) {
                    updateData.nfeCertificateSubject = 'Certificado Cadastrado';
                  }
                }
              }
            }
          }

          if (foundCerts === 0) {
             throw new Error('O arquivo PFX foi descriptografado, mas não contém certificados.');
          }

          if (expiryDate) {
            updateData.nfeCertificateExpiry = expiryDate;
          }

          console.log('Certificado processado com sucesso:', {
            subject: updateData.nfeCertificateSubject,
            expiry: updateData.nfeCertificateExpiry
          });

          // 2. Criptografar Senha do Certificado antes de salvar
          // Usando a mesma lógica do BackupCryptoService que já lida com cifra reversível
          updateData.nfeCertificatePassword = BackupCryptoService.encryptMasterPassword(body.nfeCertificatePassword);

        } catch (err: any) {
            return reply.code(400).send({
              success: false,
              error: { message: 'Senha do certificado inválida ou arquivo corrompido: ' + err.message }
            });
          }
        } // fecha if (password !== existingPassword)
      }

      const settings = await organizationService.updateSettings(request.user!.organizationId, updateData);

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
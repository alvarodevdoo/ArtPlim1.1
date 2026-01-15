import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  plan: z.enum(['basic', 'pro', 'enterprise']).optional()
});

const updateSettingsSchema = z.object({
  enableEngineering: z.boolean().optional(),
  enableWMS: z.boolean().optional(),
  enableProduction: z.boolean().optional(),
  enableFinance: z.boolean().optional(),
  enableAutomation: z.boolean().optional(),
  defaultMarkup: z.number().positive().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  validadeOrcamento: z.number().int().min(1).max(365).optional()
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'USER'])
});

export function createOrganizationRoutes(prisma: PrismaClient) {
  const router = Router();

  // ========== ORGANIZAÇÃO ==========

  // Buscar dados da organização
  router.get('/', async (req: any, res) => {
    try {
      // Implementação temporária - retorna dados mock
      const organization = {
        id: req.user.organizationId,
        name: 'ArtPlim Gráfica',
        cnpj: '12.345.678/0001-90',
        plan: 'pro',
        createdAt: new Date().toISOString(),
        settings: {
          enableEngineering: true,
          enableWMS: true,
          enableProduction: true,
          enableFinance: true,
          defaultMarkup: 1.5,
          taxRate: 0.18,
          validadeOrcamento: 30
        }
      };

      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      console.error('Erro ao buscar organização:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar organização
  router.put('/', async (req: any, res) => {
    try {
      const body = updateOrganizationSchema.parse(req.body);

      // Implementação temporária - retorna dados mock atualizados
      const organization = {
        id: req.user.organizationId,
        name: body.name || 'ArtPlim Gráfica',
        cnpj: body.cnpj || '12.345.678/0001-90',
        plan: body.plan || 'pro',
        updatedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      console.error('Erro ao atualizar organização:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== CONFIGURAÇÕES ==========

  // Buscar configurações
  router.get('/settings', async (req: any, res) => {
    try {
      console.log('🔍 GET /api/organization/settings - User:', req.user);

      // Buscar configurações reais do banco de dados
      let settings = await prisma.organizationSettings.findUnique({
        where: {
          organizationId: req.user.organizationId
        }
      });

      // Se não existir, criar com valores padrão
      if (!settings) {
        console.log('⚠️ Configurações não encontradas, criando com valores padrão...');
        settings = await prisma.organizationSettings.create({
          data: {
            organizationId: req.user.organizationId,
            enableEngineering: false,
            enableWMS: false,
            enableProduction: false,
            enableFinance: true,
            enableAutomation: true,
            defaultMarkup: 2.0,
            taxRate: 0.0,
            validadeOrcamento: 7
          }
        });
      }

      console.log('✅ Settings retornadas:', settings);

      res.json({
        success: true,
        data: {
          id: settings.id,
          enableEngineering: settings.enableEngineering,
          enableWMS: settings.enableWMS,
          enableProduction: settings.enableProduction,
          enableFinance: settings.enableFinance,
          enableAutomation: settings.enableAutomation,
          defaultMarkup: settings.defaultMarkup,
          taxRate: settings.taxRate,
          validadeOrcamento: settings.validadeOrcamento
        }
      });
    } catch (error) {
      console.error('❌ Erro ao buscar configurações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar configurações
  router.put('/settings', async (req: any, res) => {
    try {
      console.log('🔄 PUT /api/organization/settings - Body:', req.body);
      const body = updateSettingsSchema.parse(req.body);

      // Usar upsert para atualizar ou criar se não existir
      const settings = await prisma.organizationSettings.upsert({
        where: {
          organizationId: req.user.organizationId
        },
        update: {
          enableEngineering: body.enableEngineering,
          enableWMS: body.enableWMS,
          enableProduction: body.enableProduction,
          enableFinance: body.enableFinance,
          enableAutomation: body.enableAutomation,
          defaultMarkup: body.defaultMarkup,
          taxRate: body.taxRate,
          validadeOrcamento: body.validadeOrcamento
        },
        create: {
          organizationId: req.user.organizationId,
          enableEngineering: body.enableEngineering ?? false,
          enableWMS: body.enableWMS ?? false,
          enableProduction: body.enableProduction ?? false,
          enableFinance: body.enableFinance ?? true,
          enableAutomation: body.enableAutomation ?? true,
          defaultMarkup: body.defaultMarkup ?? 2.0,
          taxRate: body.taxRate ?? 0.0,
          validadeOrcamento: body.validadeOrcamento ?? 7
        }
      });

      console.log('✅ Configurações salvas no banco:', settings);

      res.json({
        success: true,
        data: {
          id: settings.id,
          enableEngineering: settings.enableEngineering,
          enableWMS: settings.enableWMS,
          enableProduction: settings.enableProduction,
          enableFinance: settings.enableFinance,
          enableAutomation: settings.enableAutomation,
          defaultMarkup: settings.defaultMarkup,
          taxRate: settings.taxRate,
          validadeOrcamento: settings.validadeOrcamento,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar configurações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== USUÁRIOS ==========

  // Listar usuários da organização
  router.get('/users', async (req: any, res) => {
    try {
      // Implementação temporária - retorna dados mock
      const users = [
        {
          id: '1',
          name: 'Admin Sistema',
          email: 'admin@artplim.com',
          role: 'ADMIN',
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'João Silva',
          email: 'joao@artplim.com',
          role: 'USER',
          active: true,
          createdAt: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Criar usuário
  router.post('/users', async (req: any, res) => {
    try {
      const body = createUserSchema.parse(req.body);

      // Implementação temporária - retorna dados mock
      const user = {
        id: Date.now().toString(),
        name: body.name,
        email: body.email,
        role: body.role,
        active: true,
        createdAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar usuário
  router.put('/users/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = createUserSchema.partial().parse(req.body);

      // Implementação temporária - retorna dados mock
      const user = {
        id,
        name: body.name || 'Usuário Atualizado',
        email: body.email || 'usuario@artplim.com',
        role: body.role || 'USER',
        active: true,
        updatedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Desativar usuário
  router.delete('/users/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Implementação temporária - simula desativação
      res.json({
        success: true,
        message: 'Usuário desativado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao desativar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';

const listQuerySchema = z.object({
  isCustomer: z.string().transform(val => val === 'true').optional(),
  isEmployee: z.string().transform(val => val === 'true').optional(),
  isSupplier: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional()
});

const createProfileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  isEmployee: z.boolean().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional()
});

const updateProfileSchema = createProfileSchema.partial();

export function createOptimizedProfilesRoutes(prisma: PrismaClient) {
  const router = Router();
  
  // ========== PERFIS OTIMIZADOS ==========
  
  // Listar perfis com QueryOptimizer
  router.get('/', async (req: any, res) => {
    try {
      console.log('🔍 GET /api/profiles - Query:', req.query);
      console.log('🔍 User:', req.user);
      
      const query = listQuerySchema.parse(req.query);
      console.log('🔍 Query validada:', query);
      
      const queryOptimizer = new QueryOptimizer(prisma);
      
      // Usar query otimizada baseada no tipo solicitado
      let profiles;
      
      if (query.isCustomer) {
        console.log('🔍 Buscando clientes otimizados...');
        profiles = await queryOptimizer.getOptimizedCustomers(
          req.user.organizationId,
          query.limit || 50
        );
      } else if (query.isEmployee) {
        console.log('🔍 Buscando funcionários otimizados...');
        profiles = await queryOptimizer.getOptimizedEmployees(
          req.user.organizationId,
          query.limit || 50
        );
      } else {
        console.log('🔍 Buscando todos os perfis...');
        // Query genérica para todos os perfis
        profiles = await prisma.profile.findMany({
          where: {
            organizationId: req.user.organizationId,
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
      
      console.log('✅ Perfis encontrados:', profiles.length);
      
      res.json({
        success: true,
        data: profiles
      });
    } catch (error) {
      console.error('❌ Erro ao listar perfis otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Listar clientes otimizado
  router.get('/customers/list', async (req: any, res) => {
    try {
      const queryOptimizer = new QueryOptimizer(prisma);
      
      const customers = await queryOptimizer.getOptimizedCustomers(
        req.user.organizationId,
        100
      );
      
      res.json({
        success: true,
        data: customers
      });
    } catch (error) {
      console.error('Erro ao listar clientes otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Listar funcionários otimizado
  router.get('/employees/list', async (req: any, res) => {
    try {
      const queryOptimizer = new QueryOptimizer(prisma);
      
      const employees = await queryOptimizer.getOptimizedEmployees(
        req.user.organizationId,
        100
      );
      
      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      console.error('Erro ao listar funcionários otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== CRUD OPERATIONS ==========

  // Criar perfil
  router.post('/', async (req: any, res) => {
    try {
      console.log('🔍 POST /api/profiles - Dados recebidos:', req.body);
      console.log('🔍 User info:', req.user);
      
      const body = createProfileSchema.parse(req.body);
      console.log('🔍 Dados validados:', body);
      
      if (!req.user || !req.user.organizationId) {
        console.error('❌ Usuário não autenticado ou sem organizationId');
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }
      
      const profile = await prisma.profile.create({
        data: {
          ...body,
          email: body.email === '' ? null : body.email, // Converter string vazia para null
          document: body.document === '' ? null : body.document, // Converter string vazia para null
          organizationId: req.user.organizationId,
          // Definir padrões se não especificado
          type: body.type || 'INDIVIDUAL',
          isCustomer: body.isCustomer ?? true,
          isSupplier: body.isSupplier ?? false,
          isEmployee: body.isEmployee ?? false
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
          address: true,
          city: true,
          state: true,
          zipCode: true,
          createdAt: true
        }
      });
      
      console.log('✅ Perfil criado:', profile);
      
      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('❌ Erro ao criar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Buscar perfil por ID
  router.get('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const profile = await prisma.profile.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
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
          address: true,
          city: true,
          state: true,
          zipCode: true,
          createdAt: true
        }
      });

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Perfil não encontrado'
        });
      }
      
      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar perfil
  router.put('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = updateProfileSchema.parse(req.body);
      
      // Verificar se o perfil existe e pertence à organização
      const existingProfile = await prisma.profile.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingProfile) {
        return res.status(404).json({
          success: false,
          message: 'Perfil não encontrado'
        });
      }
      
      const profile = await prisma.profile.update({
        where: { id },
        data: body,
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
          address: true,
          city: true,
          state: true,
          zipCode: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Deletar perfil
  router.delete('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o perfil existe e pertence à organização
      const existingProfile = await prisma.profile.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingProfile) {
        return res.status(404).json({
          success: false,
          message: 'Perfil não encontrado'
        });
      }

      // Verificar se o perfil não está sendo usado em pedidos
      const ordersCount = await prisma.order.count({
        where: {
          customerId: id
        }
      });

      if (ordersCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível excluir este perfil pois ele possui pedidos associados'
        });
      }
      
      await prisma.profile.delete({
        where: { id }
      });
      
      res.json({
        success: true,
        message: 'Perfil excluído com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}
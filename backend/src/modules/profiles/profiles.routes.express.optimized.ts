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
  addressNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).or(z.literal('')).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'USER']).optional()
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

      const where: any = {
        organizationId: req.user.organizationId,
        ...(query.isCustomer !== undefined && { isCustomer: query.isCustomer }),
        ...(query.isEmployee !== undefined && { isEmployee: query.isEmployee }),
        ...(query.isSupplier !== undefined && { isSupplier: query.isSupplier }),
      };

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { document: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } }
        ];
      }

      const profiles = await prisma.profile.findMany({
        where,
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
          addressNumber: true,
          city: true,
          state: true,
          zipCode: true,
          active: true,
          createdAt: true,
          user: {
            select: {
              role: true
            }
          }
        },
        take: query.limit || 50,
        orderBy: { name: 'asc' }
      });

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

      // Extrair password e role antes de criar o perfil
      const { password, role, ...profileData } = body;

      // Buscar configurações da organização
      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: req.user.organizationId }
      });

      // Validar documento (CPF/CNPJ NÃO PODE REPETIR)
      if (profileData.document && profileData.document !== '') {
        const existingDocument = await prisma.profile.findFirst({
          where: {
            organizationId: req.user.organizationId,
            document: profileData.document
          }
        });

        if (existingDocument) {
          return res.status(400).json({
            success: false,
            message: 'Já existe um cliente cadastrado com este CPF/CNPJ.'
          });
        }
      }

      // Validar telefone se não permitido duplicidade
      if (profileData.phone && settings?.allowDuplicatePhones === false) {
        const cleanPhone = profileData.phone.replace(/\D/g, '');
        const existingPhone = await prisma.profile.findFirst({
          where: {
            organizationId: req.user.organizationId,
            phone: { contains: cleanPhone }
          }
        });

        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: `O telefone ${profileData.phone} já pertence ao cliente "${existingPhone.name}".`
          });
        }
      }

      const profile = await prisma.profile.create({
        data: {
          ...profileData,
          email: profileData.email === '' ? null : profileData.email,
          document: profileData.document === '' ? null : profileData.document,
          organizationId: req.user.organizationId,
          type: profileData.type || 'INDIVIDUAL',
          isCustomer: profileData.isCustomer ?? true,
          isSupplier: profileData.isSupplier ?? false,
          isEmployee: profileData.isEmployee ?? false,
          active: profileData.active ?? true
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
          addressNumber: true,
          city: true,
          state: true,
          zipCode: true,
          active: true,
          createdAt: true
        }
      });

      // Se for funcionário com senha e email, criar/atualizar User
      if (profile.isEmployee && password && password.trim() !== '' && profile.email) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Verificar se já existe um usuário com este email
        const existingUser = await prisma.user.findFirst({
          where: {
            organizationId: req.user.organizationId,
            email: profile.email
          }
        });

        let connectedUserId = '';

        if (existingUser) {
          const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              password: hashedPassword,
              name: profile.name,
              active: profile.active,
              role: role || 'USER'
            }
          });
          connectedUserId = updatedUser.id;
        } else {
          const newUser = await prisma.user.create({
            data: {
              organizationId: req.user.organizationId,
              email: profile.email,
              password: hashedPassword,
              name: profile.name,
              role: role || 'USER',
              active: profile.active
            }
          });
          connectedUserId = newUser.id;
        }

        // Vincular ao Profile
        await prisma.profile.update({
          where: { id: profile.id },
          data: { userId: connectedUserId }
        });
      }

      console.log('✅ Perfil criado:', profile);

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar perfil:', error);

      // Tratar erro de duplicidade (Prisma P2002)
      if (error.code === 'P2002') {
        const target = error.meta?.target || [];
        if (target.includes('document')) {
          return res.status(400).json({
            success: false,
            message: 'Já existe um cliente cadastrado com este CPF/CNPJ.'
          });
        }
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor ao criar perfil'
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
          addressNumber: true,
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

      // Extrair password e role antes de atualizar o perfil
      const { password, role, ...profileData } = body;

      // Buscar configurações da organização
      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: req.user.organizationId }
      });

      // Validar documento (CPF/CNPJ NÃO PODE REPETIR)
      if (profileData.document && profileData.document !== '') {
        const existingDocument = await prisma.profile.findFirst({
          where: {
            organizationId: req.user.organizationId,
            document: profileData.document,
            id: { not: id }
          }
        });

        if (existingDocument) {
          return res.status(400).json({
            success: false,
            message: 'Já existe outro cliente cadastrado com este CPF/CNPJ.'
          });
        }
      }

      // Validar telefone se não permitido duplicidade
      if (profileData.phone && settings?.allowDuplicatePhones === false) {
        const cleanPhone = profileData.phone.replace(/\D/g, '');
        const existingPhone = await prisma.profile.findFirst({
          where: {
            organizationId: req.user.organizationId,
            phone: { contains: cleanPhone },
            id: { not: id }
          }
        });

        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: `O telefone ${profileData.phone} já pertence ao cliente "${existingPhone.name}".`
          });
        }
      }

      const profile = await prisma.profile.update({
        where: { id },
        data: profileData,
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
          addressNumber: true,
          city: true,
          state: true,
          zipCode: true,
          active: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Se for funcionário e houver senha ou mudança de status, sincronizar com User
      if (profile.isEmployee && profile.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            organizationId: req.user.organizationId,
            email: profile.email
          }
        });

        if (password && password.trim() !== '') {
          // Se há senha, criar ou atualizar usuário
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(password, 10);

          let connectedUserId = '';

          if (existingUser) {
            const updatedUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                password: hashedPassword,
                name: profile.name,
                role: role || 'USER',
                active: profile.active
              }
            });
            connectedUserId = updatedUser.id;
          } else {
            const newUser = await prisma.user.create({
              data: {
                organizationId: req.user.organizationId,
                email: profile.email,
                password: hashedPassword,
                name: profile.name,
                role: role || 'USER',
                active: profile.active
              }
            });
            connectedUserId = newUser.id;
          }

          // Vincular ao Profile (Silencioso se já estiver vinculado)
          try {
            await prisma.profile.update({
              where: { id: profile.id },
              data: { userId: connectedUserId }
            });
          } catch (e) {
            console.log('ℹ️ Vínculo de usuário já existente ou inválido para este perfil');
          }
        } else if (existingUser && (profileData.active !== undefined || role !== undefined)) {
          // Se não há senha mas há mudança de status ou cargo, atualizar o usuário
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              active: profile.active,
              name: profile.name,
              ...(role && { role })
            }
          });

          // Garantir vínculo (Silencioso se já estiver vinculado)
          if (!profile.userId) {
            try {
              await prisma.profile.update({
                where: { id: profile.id },
                data: { userId: existingUser.id }
              });
            } catch (e) {
              // Já vinculado ou erro de restrição única
            }
          }
        }
      }

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
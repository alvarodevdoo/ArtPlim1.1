import bcrypt from 'bcryptjs';
import { prisma } from '../../../shared/infrastructure/database/prisma';
import { AppError, ValidationError } from '../../../shared/infrastructure/errors/AppError';
import { SeedChartOfAccountsUseCase } from '../../chartOfAccounts/useCases/SeedChartOfAccountsUseCase';


interface LoginData {
  email: string;
  password: string;
  organizationSlug: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  organizationSlug: string;
}

export class AuthService {

  async login({ email: loginEmail, password, organizationSlug }: LoginData) {
    const email = loginEmail.toLowerCase();
    // Buscar organização
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug }
    });

    if (!organization || !organization.active) {
      throw new ValidationError('Organização não encontrada ou inativa');
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email
        }
      },
      include: {
        customRole: {
          include: { permissions: true }
        }
      }
    });

    if (!user) {
      console.log(`[AuthService] Usuário não encontrado: ${email} na organização ${organization.slug} (ID: ${organization.id})`);
      throw new ValidationError('Credenciais inválidas');
    }

    if (!user.active) {
      console.log(`[AuthService] Usuário inativo: ${email}`);
      throw new ValidationError('Credenciais inválidas');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new ValidationError('Credenciais inválidas');
    }

    // Gerar token JWT
    const payload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role
    };

    // O token será gerado no controller usando fastify.jwt.sign

    return {
      payload,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: organization.name,
        permissions: user.customRole?.permissions.map(p => p.permissionKey) || 
          (user.role === 'OWNER' ? ['admin.organization', 'admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view', 'finance.reports'] : 
           user.role === 'ADMIN' ? ['admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view', 'finance.reports'] : [])
      }
    };
  }

  async register({ name, email: rawEmail, password, organizationName, organizationSlug }: RegisterData) {
    const email = rawEmail.toLowerCase();
    // Verificar se a organização já existe
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: organizationSlug }
    });

    if (existingOrg) {
      throw new ValidationError('Slug da organização já está em uso');
    }

    // Verificar se o email já existe globalmente (opcional)
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      throw new ValidationError('Email já está em uso');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar organização e usuário em transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar organização
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug
        }
      });

      // Criar configurações padrão
      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id
        }
      });

      // Alimentar o plano de contas básico
      const seedUseCase = new SeedChartOfAccountsUseCase();
      await seedUseCase.execute(organization.id, tx);

      // Criar roles padrão da organização (RBAC)
      const roles = [
        { name: 'Proprietário', isSystem: true, permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve', 'finance.view', 'finance.costs', 'finance.margins', 'finance.reports', 'production.view', 'production.manage', 'inventory.view', 'inventory.manage', 'admin.users', 'admin.settings', 'admin.organization'] },
        { name: 'Administrador', isSystem: true, permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve', 'finance.view', 'finance.costs', 'finance.margins', 'finance.reports', 'production.view', 'production.manage', 'inventory.view', 'inventory.manage', 'admin.users', 'admin.settings'] },
        { name: 'Gerente', isSystem: true, permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.approve', 'finance.view', 'finance.costs', 'production.view', 'production.manage', 'inventory.view', 'inventory.manage'] },
        { name: 'Operador', isSystem: true, permissions: ['production.view', 'production.manage', 'inventory.view'] },
        { name: 'Usuário', isSystem: true, permissions: ['sales.view', 'sales.create', 'sales.edit'] }
      ];

      let ownerRoleId = '';

      for (const r of roles) {
        const createdRole = await tx.role.create({
          data: {
            organizationId: organization.id,
            name: r.name,
            isSystem: r.isSystem,
            permissions: {
              create: r.permissions.map(pk => ({ permissionKey: pk }))
            }
          }
        });
        if (r.name === 'Proprietário') ownerRoleId = createdRole.id;
      }

      // Criar usuário owner
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          name,
          email,
          password: hashedPassword,
          role: 'OWNER',
          roleId: ownerRoleId
        }
      });

      return { organization, user };
    });

    return {
      message: 'Organização e usuário criados com sucesso',
      organizationSlug: result.organization.slug,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role
      }
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true
          }
        },
        customRole: {
          include: { permissions: true }
        }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      permissions: user.customRole?.permissions.map(p => p.permissionKey) || 
        (user.role === 'OWNER' ? ['admin.organization', 'admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view', 'finance.reports'] : 
         user.role === 'ADMIN' ? ['admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view', 'finance.reports'] : [])
    };
  }
}
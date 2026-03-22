import bcrypt from 'bcryptjs';
import { NotFoundError, ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface CreateUserInput {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
  active?: boolean;
}

export class UserService {
  constructor(private prisma: any) {}

  async listByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async create(data: CreateUserInput & { email: string }) {
    const email = data.email.toLowerCase();
    // Verificar se email já existe na organização
    const existingUser = await this.prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: data.organizationId,
          email
        }
      }
    });

    if (existingUser) {
      throw new ValidationError('Email já está em uso nesta organização');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        email: email,
        password: hashedPassword,
        role: data.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true
      }
    });

    return user;
  }

  async update(id: string, organizationId: string, data: UpdateUserInput) {
    // Verificar se usuário existe e pertence à organização
    const existingUser = await this.prisma.user.findFirst({
      where: { id, organizationId }
    });

    if (!existingUser) {
      throw new NotFoundError('Usuário');
    }

    // Se está alterando email, verificar se não existe outro usuário com o mesmo email
    if (data.email && data.email.toLowerCase() !== existingUser.email) {
      const email = data.email.toLowerCase();
      const emailExists = await this.prisma.user.findUnique({
        where: {
          organizationId_email: {
            organizationId,
            email: data.email
          }
        }
      });

      if (emailExists) {
        throw new ValidationError('Email já está em uso nesta organização');
      }
    }

    // Preparar dados para atualização
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };

    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }

    // Se está alterando senha, fazer hash
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user;
  }

  async deactivate(id: string, organizationId: string) {
    // Verificar se usuário existe e pertence à organização
    const existingUser = await this.prisma.user.findFirst({
      where: { id, organizationId }
    });

    if (!existingUser) {
      throw new NotFoundError('Usuário');
    }

    // Não permitir desativar o próprio usuário se for OWNER
    if (existingUser.role === 'OWNER') {
      throw new ValidationError('Não é possível desativar o proprietário da organização');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date()
      }
    });

    return { message: 'Usuário desativado com sucesso' };
  }

  async findById(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    return user;
  }

  async changePassword(id: string, organizationId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId }
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new ValidationError('Senha atual incorreta');
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    return { message: 'Senha alterada com sucesso' };
  }
}
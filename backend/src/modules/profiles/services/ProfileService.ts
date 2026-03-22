import { ProfileType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NotFoundError, ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface CreateProfileInput {
  type: ProfileType;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  address?: string;
  addressNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  organizationId?: string;
  creditLimit?: number;
  paymentTerms?: number;
  password?: string;
  role?: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'USER' | 'CUSTOMER';
}

interface ListFilters {
  type?: ProfileType;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isEmployee?: boolean;
  search?: string;
}

export class ProfileService {
  constructor(private prisma: any) { }

  async create(data: CreateProfileInput) {
    // Normalizar campos opcionais (converter strings vazias para null)
    const normalizedData = {
      ...data,
      document: data.document?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zipCode: data.zipCode?.trim() || null,
      addressNumber: data.addressNumber?.trim() || null
    };

    // Buscar configurações se organizationId estiver presente
    let allowDuplicatePhones = true;
    if (normalizedData.organizationId) {
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId: normalizedData.organizationId }
      });
      allowDuplicatePhones = settings?.allowDuplicatePhones ?? true;
    }

    // Validar documento (CPF/CNPJ NÃO PODE REPETIR)
    if (normalizedData.document) {
      const existingProfile = await this.prisma.profile.findFirst({
        where: {
          organizationId: normalizedData.organizationId,
          document: normalizedData.document
        }
      });

      if (existingProfile) {
        throw new ValidationError('Já existe um cliente cadastrado com este CPF/CNPJ.');
      }
    }

    // Validar telefone se não permitido duplicidade
    if (normalizedData.phone && !allowDuplicatePhones) {
      const cleanPhone = normalizedData.phone.replace(/\D/g, '');
      const existingPhone = await this.prisma.profile.findFirst({
        where: {
          organizationId: normalizedData.organizationId,
          phone: { contains: cleanPhone }
        }
      });

      if (existingPhone) {
        throw new ValidationError(`O telefone ${normalizedData.phone} já pertence ao cliente ${existingPhone.name}. Verifique as configurações para permitir duplicidade se necessário.`);
      }
    }

    // Validar email se fornecido
    if (normalizedData.email) {
      const existingEmail = await this.prisma.profile.findFirst({
        where: {
          email: normalizedData.email
        }
      });

      if (existingEmail) {
        throw new ValidationError('Email já cadastrado');
      }
    }

    // Usar transação se for funcionário e tiver senha (para criar o usuário)
    const profile = await this.prisma.$transaction(async (tx: any) => {
      let userId = null;

      // Se for funcionário ou cliente e tiver senha, criar o usuário
      if ((normalizedData.isEmployee || normalizedData.isCustomer) && normalizedData.password) {
        // Verificar se já existe um usuário com este email
        if (normalizedData.email) {
          const existingUser = await tx.user.findFirst({
            where: {
              organizationId: normalizedData.organizationId,
              email: normalizedData.email.toLowerCase()
            }
          });

          if (existingUser) {
            throw new ValidationError('Email já está sendo usado por outro usuário');
          }

          // Hash da senha
          const hashedPassword = await bcrypt.hash(normalizedData.password, 10);

          // Criar usuário
          const user = await tx.user.create({
            data: {
              organizationId: normalizedData.organizationId,
              name: normalizedData.name,
              email: normalizedData.email.toLowerCase(),
              password: hashedPassword,
              role: normalizedData.role || 'USER'
            }
          });

          userId = user.id;
        }
      }

      const createdProfile = await tx.profile.create({
        data: {
          type: normalizedData.type,
          name: normalizedData.name,
          document: normalizedData.document,
          email: normalizedData.email ? normalizedData.email.toLowerCase() : null,
          phone: normalizedData.phone,
          address: normalizedData.address,
          city: normalizedData.city,
          state: normalizedData.state,
          zipCode: normalizedData.zipCode,
          isCustomer: normalizedData.isCustomer,
          isSupplier: normalizedData.isSupplier,
          isEmployee: normalizedData.isEmployee,
          organizationId: normalizedData.organizationId,
          addressNumber: normalizedData.addressNumber,
          creditLimit: normalizedData.creditLimit,
          paymentTerms: normalizedData.paymentTerms,
          userId: userId
        }
      });

      return createdProfile;
    });

    return profile;
  }

  async list(filters: ListFilters = {}) {
    const where: any = {
      active: true
    };

    // Aplicar filtros
    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isCustomer !== undefined) {
      where.isCustomer = filters.isCustomer;
    }

    if (filters.isSupplier !== undefined) {
      where.isSupplier = filters.isSupplier;
    }

    if (filters.isEmployee !== undefined) {
      where.isEmployee = filters.isEmployee;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { document: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.profile.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: {
              where: { status: { not: 'CANCELLED' } }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findById(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Últimos 10 pedidos
        },
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!profile) {
      throw new NotFoundError('Perfil');
    }

    return profile;
  }

  async update(id: string, data: Partial<CreateProfileInput>) {
    // Verificar se perfil existe
    await this.findById(id);

    // Normalizar campos opcionais
    const normalizedData = {
      ...data,
      document: data.document?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      addressNumber: data.addressNumber?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zipCode: data.zipCode?.trim() || null
    };

    // Buscar configurações se organizationId estiver presente
    let allowDuplicatePhones = true;
    if (data.organizationId) {
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId: data.organizationId }
      });
      allowDuplicatePhones = settings?.allowDuplicatePhones ?? true;
    }

    // Validar documento (CPF/CNPJ NÃO PODE REPETIR)
    if (normalizedData.document) {
      const existingProfile = await this.prisma.profile.findFirst({
        where: {
          organizationId: data.organizationId,
          document: normalizedData.document,
          id: { not: id }
        }
      });

      if (existingProfile) {
        throw new ValidationError('Já existe outro cliente cadastrado com este CPF/CNPJ.');
      }
    }

    // Validar telefone se não permitido duplicidade e alterado
    if (normalizedData.phone && !allowDuplicatePhones) {
      const cleanPhone = normalizedData.phone.replace(/\D/g, '');
      const existingPhone = await this.prisma.profile.findFirst({
        where: {
          organizationId: data.organizationId,
          phone: { contains: cleanPhone },
          id: { not: id }
        }
      });

      if (existingPhone) {
        throw new ValidationError(`O telefone ${normalizedData.phone} já pertence ao cliente ${existingPhone.name}.`);
      }
    }

    // Validar email se alterado
    if (normalizedData.email) {
      const existingEmail = await this.prisma.profile.findFirst({
        where: {
          email: normalizedData.email,
          id: { not: id }
        }
      });

      if (existingEmail) {
        throw new ValidationError('Email já cadastrado');
      }
    }

    const profile = await this.prisma.$transaction(async (tx: any) => {
      // Atualizar ou criar usuário se for funcionário ou cliente
      if ((normalizedData.isEmployee || normalizedData.isCustomer) && (normalizedData.password || normalizedData.role)) {
        const existingProfileWithUser = await tx.profile.findUnique({
          where: { id },
          include: { user: true }
        });

        if (existingProfileWithUser?.userId) {
          // Atualizar o usuário existente
          const updateData: any = {
            name: normalizedData.name || existingProfileWithUser.name,
            role: normalizedData.role || existingProfileWithUser.user.role,
            updatedAt: new Date()
          };

          if (normalizedData.email) {
            updateData.email = normalizedData.email.toLowerCase();
          }

          if (normalizedData.password) {
            updateData.password = await bcrypt.hash(normalizedData.password, 10);
          }

          await tx.user.update({
            where: { id: existingProfileWithUser.userId },
            data: updateData
          });
        } else if (normalizedData.password && normalizedData.email) {
          // Criar novo usuário e vincular
          const hashedPassword = await bcrypt.hash(normalizedData.password, 10);
          const user = await tx.user.create({
            data: {
              organizationId: data.organizationId || existingProfileWithUser.organizationId,
              name: normalizedData.name || existingProfileWithUser.name,
              email: normalizedData.email.toLowerCase(),
              password: hashedPassword,
              role: normalizedData.role || 'USER'
            }
          });

          // Vincular ao perfil nos dados de atualização do perfil
          (normalizedData as any).userId = user.id;
        }
      }

      // Limpar campos que não pertencem ao Profile no Prisma
      const profileData = { ...normalizedData };
      delete (profileData as any).password;
      delete (profileData as any).role;

      if (profileData.email) {
        profileData.email = profileData.email.toLowerCase();
      }

      return await tx.profile.update({
        where: { id },
        data: {
          ...profileData,
          updatedAt: new Date()
        }
      });
    });

    return profile;
  }

  async delete(id: string) {
    // Verificar se perfil existe
    await this.findById(id);

    // Verificar se tem pedidos associados
    const orderCount = await this.prisma.order.count({
      where: { customerId: id }
    });

    if (orderCount > 0) {
      throw new ValidationError('Perfil não pode ser removido pois possui pedidos associados');
    }

    // Soft delete
    await this.prisma.profile.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date()
      }
    });

    return { message: 'Perfil removido com sucesso' };
  }

  async getCustomerStats(customerId: string) {
    const customer = await this.findById(customerId);

    if (!customer.isCustomer) {
      throw new ValidationError('Perfil não é um cliente');
    }

    // Estatísticas dos pedidos
    const stats = await this.prisma.order.aggregate({
      where: {
        customerId,
        status: { not: 'CANCELLED' }
      },
      _sum: {
        total: true
      },
      _count: {
        id: true
      }
    });

    // Último pedido
    const lastOrder = await this.prisma.order.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true
      }
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        creditLimit: customer.creditLimit,
        paymentTerms: customer.paymentTerms
      },
      stats: {
        totalOrders: stats._count.id || 0,
        totalValue: Number(stats._sum.total || 0),
        averageOrderValue: stats._count.id ? Number(stats._sum.total || 0) / stats._count.id : 0
      },
      lastOrder
    };
  }
}
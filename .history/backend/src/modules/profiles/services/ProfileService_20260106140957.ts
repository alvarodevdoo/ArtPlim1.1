import { ProfileType } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../@core/errors/AppError';

interface CreateProfileInput {
  type: ProfileType;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  creditLimit?: number;
  paymentTerms?: number;
}

interface ListFilters {
  type?: ProfileType;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isEmployee?: boolean;
  search?: string;
}

export class ProfileService {
  constructor(private prisma: any) {}

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
      zipCode: data.zipCode?.trim() || null
    };

    // Validar documento se fornecido
    if (normalizedData.document) {
      const existingProfile = await this.prisma.profile.findFirst({
        where: {
          document: normalizedData.document
        }
      });

      if (existingProfile) {
        throw new ValidationError('Documento já cadastrado');
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

    const profile = await this.prisma.profile.create({
      data: {
        type: normalizedData.type,
        name: normalizedData.name,
        document: normalizedData.document,
        email: normalizedData.email,
        phone: normalizedData.phone,
        address: normalizedData.address,
        city: normalizedData.city,
        state: normalizedData.state,
        zipCode: normalizedData.zipCode,
        isCustomer: normalizedData.isCustomer,
        isSupplier: normalizedData.isSupplier,
        isEmployee: normalizedData.isEmployee,
        creditLimit: normalizedData.creditLimit,
        paymentTerms: normalizedData.paymentTerms
      }
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
            orders: true
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
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zipCode: data.zipCode?.trim() || null
    };

    // Validar documento se alterado
    if (normalizedData.document) {
      const existingProfile = await this.prisma.profile.findFirst({
        where: {
          document: normalizedData.document,
          id: { not: id }
        }
      });

      if (existingProfile) {
        throw new ValidationError('Documento já cadastrado');
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

    const profile = await this.prisma.profile.update({
      where: { id },
      data: {
        ...normalizedData,
        updatedAt: new Date()
      }
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
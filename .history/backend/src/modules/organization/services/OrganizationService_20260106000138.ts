import { NotFoundError } from '../../../@core/errors/AppError';

interface UpdateOrganizationInput {
  name?: string;
  cnpj?: string;
  plan?: string;
}

interface UpdateSettingsInput {
  enableEngineering?: boolean;
  enableWMS?: boolean;
  enableProduction?: boolean;
  enableFinance?: boolean;
  defaultMarkup?: number;
  taxRate?: number;
  validadeOrcamento?: number;
}

export class OrganizationService {
  constructor(private prisma: any) {}

  async findById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            profiles: true,
            products: true,
            materials: true,
            orders: true
          }
        }
      }
    });

    if (!organization) {
      throw new NotFoundError('Organização');
    }

    return organization;
  }

  async update(id: string, data: UpdateOrganizationInput) {
    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        settings: true
      }
    });

    return organization;
  }

  async getSettings(organizationId: string) {
    let settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId }
    });

    // Se não existir configurações, criar com valores padrão
    if (!settings) {
      settings = await this.prisma.organizationSettings.create({
        data: {
          organizationId,
          enableEngineering: false,
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7
        }
      });
    }

    return settings;
  }

  async updateSettings(organizationId: string, data: UpdateSettingsInput) {
    // Verificar se configurações existem
    const existingSettings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId }
    });

    if (existingSettings) {
      // Atualizar configurações existentes
      return await this.prisma.organizationSettings.update({
        where: { organizationId },
        data
      });
    } else {
      // Criar novas configurações
      return await this.prisma.organizationSettings.create({
        data: {
          organizationId,
          enableEngineering: false,
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7,
          ...data
        }
      });
    }
  }

  async getStats(organizationId: string) {
    const [
      totalUsers,
      totalProfiles,
      totalProducts,
      totalMaterials,
      totalOrders,
      monthlyRevenue
    ] = await Promise.all([
      this.prisma.user.count({
        where: { organizationId, active: true }
      }),
      this.prisma.profile.count({
        where: { organizationId, active: true }
      }),
      this.prisma.product.count({
        where: { organizationId, active: true }
      }),
      this.prisma.material.count({
        where: { organizationId, active: true }
      }),
      this.prisma.order.count({
        where: { organizationId }
      }),
      this.prisma.order.aggregate({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          },
          status: { not: 'CANCELLED' }
        },
        _sum: {
          total: true
        }
      })
    ]);

    return {
      users: totalUsers,
      profiles: totalProfiles,
      products: totalProducts,
      materials: totalMaterials,
      orders: totalOrders,
      monthlyRevenue: Number(monthlyRevenue._sum.total || 0)
    };
  }
}
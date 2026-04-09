import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface UpdateOrganizationInput {
  name?: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  plan?: string;
  email?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

interface UpdateSettingsInput {
  enableWMS?: boolean;
  enableProduction?: boolean;
  enableFinance?: boolean;
  enableFinanceReports?: boolean;
  enableAutomation?: boolean;
  defaultMarkup?: number;
  taxRate?: number;
  validadeOrcamento?: number;
  allowDuplicatePhones?: boolean;
  requireDocumentKeyForEntry?: boolean;
  defaultReceivableCategoryId?: string | null;
  defaultRevenueCategoryId?: string | null;
  defaultBackupPassword?: string | null;
  recoveryToken?: string | null;
  defaultSalesUnit?: string;
  freightExpenseAccountId?: string | null;
  taxExpenseAccountId?: string | null;
}

export class OrganizationService {
  constructor(private prisma: any) { }

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
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          enableFinanceReports: true,
          enableAutomation: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7,
          allowDuplicatePhones: true,
          requireDocumentKeyForEntry: false,
          defaultSalesUnit: 'MM'
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
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          enableFinanceReports: true,
          enableAutomation: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7,
          allowDuplicatePhones: true,
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
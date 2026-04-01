import { PrismaClient } from '@prisma/client';
import { BackupPayload, BackupModule } from '../backup.types';

export class ExportBackupUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(organizationId: string): Promise<BackupPayload> {
    const payload: BackupPayload['payload'] = {};

    // Módulo: Configurações
    payload.config = {
      organization: await this.prisma.organization.findMany({ where: { id: organizationId } }),
      organizationSettings: await this.prisma.organizationSettings.findMany({ where: { organizationId } }),
      automationRules: await this.prisma.automationRule.findMany({ where: { organizationId } })
    };

    // Módulo: Perfis/Clientes
    payload.profiles = {
      profile: await this.prisma.profile.findMany({ where: { organizationId } })
    };

    // Módulo: Insumos
    payload.materials = {
      materialType: await this.prisma.materialType.findMany({ where: { organizationId } }),
      material: await this.prisma.material.findMany({ where: { organizationId } }),
      insumoFornecedores: await this.prisma.insumoFornecedor.findMany({ 
        where: { material: { organizationId } } 
      }),
      materialSuppliers: await this.prisma.materialSupplier.findMany({
        where: { material: { organizationId } }
      })
    };

    // Módulo: Produtos/Catálogo
    payload.products = {
      pricingRules: await this.prisma.pricingRule.findMany({ where: { organizationId } }),
      product: await this.prisma.product.findMany({ where: { organizationId } }),
      productComponents: await this.prisma.productComponent.findMany({ 
        where: { product: { organizationId } } 
      }),
      productConfigurations: await this.prisma.productConfiguration.findMany({
        where: { product: { organizationId } }
      }),
      configurationOptions: await this.prisma.configurationOption.findMany({
        where: { configuration: { product: { organizationId } } }
      }),
      fichaTecnicaInsumos: await this.prisma.fichaTecnicaInsumo.findMany({ where: { organizationId } })
    };

    // Módulo: Produção
    payload.production = {
      processStatuses: await this.prisma.processStatus.findMany({ where: { organizationId } }),
      machines: await this.prisma.machine.findMany({ where: { organizationId } }),
      productionQueue: await this.prisma.productionQueue.findMany({ where: { organizationId } })
    };

    // Módulo: Vendas
    payload.sales = {
      budgets: await this.prisma.budget.findMany({ where: { organizationId } }),
      budgetItems: await this.prisma.budgetItem.findMany({ 
        where: { budget: { organizationId } } 
      }),
      orders: await this.prisma.order.findMany({ where: { organizationId } }),
      orderItems: await this.prisma.orderItem.findMany({ 
        where: { order: { organizationId } } 
      })
    };

    // Módulo: Financeiro
    payload.finance = {
      accounts: await this.prisma.account.findMany({ where: { organizationId } }),
      chartOfAccounts: await this.prisma.chartOfAccount.findMany({ where: { organizationId } }),
      categories: await this.prisma.category.findMany({ where: { organizationId } }),
      paymentMethods: await this.prisma.paymentMethod.findMany({ where: { organizationId } }),
      transactions: await this.prisma.transaction.findMany({ where: { organizationId } }),
      accountsPayable: await this.prisma.accountPayable.findMany({ where: { organizationId } }),
      accountsReceivable: await this.prisma.accountReceivable.findMany({ where: { organizationId } })
    };

    return {
      version: '1.0.0',
      organizationId,
      createdAt: new Date().toISOString(),
      payload
    };
  }
}

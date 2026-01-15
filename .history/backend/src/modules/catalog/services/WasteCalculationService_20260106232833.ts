import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface RegisterWasteRequest {
  orderId: string;
  productId: string;
  materialId: string;
  componentId: string;
  plannedQuantity: number;
  actualQuantity: number;
  wasteReason: string;
  reportedBy: string;
}

interface WasteStatistics {
  componentId: string;
  totalProductions: number;
  totalPlanned: number;
  totalActual: number;
  totalWaste: number;
  averageWastePercentage: number;
  lastCalculation: Date;
  periodDays: number;
}

export class WasteCalculationService {
  constructor(private prisma: any) {}

  /**
   * Registra uma perda de produção
   */
  async registerWaste(wasteData: RegisterWasteRequest) {
    // Verificar se order, product, material e component existem
    await this.validateWasteData(wasteData);

    // Calcular quantidade desperdiçada
    const wasteQuantity = wasteData.actualQuantity - wasteData.plannedQuantity;

    // Registrar a perda
    const productionWaste = await this.prisma.productionWaste.create({
      data: {
        orderId: wasteData.orderId,
        productId: wasteData.productId,
        materialId: wasteData.materialId,
        componentId: wasteData.componentId,
        plannedQuantity: wasteData.plannedQuantity,
        actualQuantity: wasteData.actualQuantity,
        wasteQuantity: wasteQuantity,
        wasteReason: wasteData.wasteReason,
        reportedBy: wasteData.reportedBy
      }
    });

    // Atualizar automaticamente o percentual de perda do componente
    await this.updateWastePercentage(wasteData.componentId);

    return productionWaste;
  }

  /**
   * Atualiza o percentual de perda de um componente baseado no histórico
   */
  async updateWastePercentage(componentId: string, periodDays: number = 90) {
    // Verificar se componente existe
    const component = await this.prisma.productComponent.findUnique({
      where: { id: componentId }
    });

    if (!component) {
      throw new NotFoundError('Componente');
    }

    // Calcular novo percentual baseado no histórico
    const newPercentage = await this.calculateWastePercentage(componentId, periodDays);

    // Atualizar o componente
    await this.prisma.productComponent.update({
      where: { id: componentId },
      data: {
        calculatedWastePercentage: newPercentage,
        wastePercentage: component.manualWastePercentage ?? newPercentage,
        lastWasteUpdate: new Date(),
        wasteCalculationPeriod: periodDays
      }
    });

    return {
      componentId,
      oldPercentage: component.wastePercentage,
      newPercentage: component.manualWastePercentage ?? newPercentage,
      calculatedPercentage: newPercentage,
      isManualOverride: component.manualWastePercentage !== null
    };
  }

  /**
   * Calcula o percentual de perda baseado no histórico
   */
  async calculateWastePercentage(componentId: string, periodDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    // Buscar todas as perdas do componente no período
    const wasteHistory = await this.prisma.productionWaste.findMany({
      where: {
        componentId,
        reportedAt: {
          gte: cutoffDate
        }
      }
    });

    if (wasteHistory.length === 0) {
      return 0.0; // Sem histórico, sem perda
    }

    // Calcular totais
    const totalPlanned = wasteHistory.reduce((sum: number, waste: any) => sum + waste.plannedQuantity, 0);
    const totalWaste = wasteHistory.reduce((sum: number, waste: any) => sum + waste.wasteQuantity, 0);

    if (totalPlanned === 0) {
      return 0.0;
    }

    // Calcular percentual (waste / planned * 100)
    const wastePercentage = (totalWaste / totalPlanned) * 100;

    // Limitar entre 0% e 100%
    return Math.max(0, Math.min(100, wastePercentage)) / 100; // Retornar como decimal (0.05 = 5%)
  }

  /**
   * Obtém o histórico de perdas de um componente
   */
  async getWasteHistory(componentId: string, periodDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const wasteHistory = await this.prisma.productionWaste.findMany({
      where: {
        componentId,
        reportedAt: {
          gte: cutoffDate
        }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        product: {
          select: {
            id: true,
            name: true
          }
        },
        material: {
          select: {
            id: true,
            name: true,
            unit: true
          }
        }
      },
      orderBy: {
        reportedAt: 'desc'
      }
    });

    return wasteHistory;
  }

  /**
   * Obtém estatísticas de desperdício de um componente
   */
  async getWasteStatistics(componentId: string, periodDays: number = 90): Promise<WasteStatistics> {
    const component = await this.prisma.productComponent.findUnique({
      where: { id: componentId },
      include: {
        product: {
          select: { name: true }
        },
        material: {
          select: { name: true, unit: true }
        }
      }
    });

    if (!component) {
      throw new NotFoundError('Componente');
    }

    const wasteHistory = await this.getWasteHistory(componentId, periodDays);

    const totalProductions = wasteHistory.length;
    const totalPlanned = wasteHistory.reduce((sum, waste) => sum + waste.plannedQuantity, 0);
    const totalActual = wasteHistory.reduce((sum, waste) => sum + waste.actualQuantity, 0);
    const totalWaste = wasteHistory.reduce((sum, waste) => sum + waste.wasteQuantity, 0);

    const averageWastePercentage = totalPlanned > 0 ? (totalWaste / totalPlanned) * 100 : 0;

    return {
      componentId,
      totalProductions,
      totalPlanned,
      totalActual,
      totalWaste,
      averageWastePercentage,
      lastCalculation: component.lastWasteUpdate,
      periodDays: component.wasteCalculationPeriod
    };
  }

  /**
   * Obtém componentes com maior desperdício
   */
  async getHighWasteComponents(limit: number = 10, periodDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    // Buscar componentes com perdas no período
    const wasteData = await this.prisma.productionWaste.groupBy({
      by: ['componentId'],
      where: {
        reportedAt: {
          gte: cutoffDate
        }
      },
      _sum: {
        plannedQuantity: true,
        wasteQuantity: true
      },
      _count: {
        id: true
      },
      having: {
        plannedQuantity: {
          _sum: {
            gt: 0
          }
        }
      }
    });

    // Calcular percentuais e buscar detalhes dos componentes
    const componentsWithWaste = await Promise.all(
      wasteData.map(async (data: any) => {
        const component = await this.prisma.productComponent.findUnique({
          where: { id: data.componentId },
          include: {
            product: {
              select: { id: true, name: true }
            },
            material: {
              select: { id: true, name: true, unit: true }
            }
          }
        });

        const wastePercentage = (data._sum.wasteQuantity / data._sum.plannedQuantity) * 100;

        return {
          componentId: data.componentId,
          product: component?.product,
          material: component?.material,
          totalProductions: data._count.id,
          totalPlanned: data._sum.plannedQuantity,
          totalWaste: data._sum.wasteQuantity,
          wastePercentage,
          currentWastePercentage: component?.wastePercentage || 0
        };
      })
    );

    // Ordenar por percentual de desperdício (maior primeiro)
    return componentsWithWaste
      .sort((a, b) => b.wastePercentage - a.wastePercentage)
      .slice(0, limit);
  }

  /**
   * Atualiza percentuais de todos os componentes
   */
  async updateAllWastePercentages(periodDays: number = 90) {
    // Buscar todos os componentes que têm histórico de perdas
    const componentsWithWaste = await this.prisma.productionWaste.groupBy({
      by: ['componentId'],
      _count: {
        id: true
      }
    });

    const results = [];

    for (const data of componentsWithWaste) {
      try {
        const result = await this.updateWastePercentage(data.componentId, periodDays);
        results.push(result);
      } catch (error) {
        console.error(`Erro ao atualizar componente ${data.componentId}:`, error);
      }
    }

    return {
      totalUpdated: results.length,
      results
    };
  }

  /**
   * Valida os dados de registro de perda
   */
  private async validateWasteData(wasteData: RegisterWasteRequest) {
    // Verificar se order existe
    const order = await this.prisma.order.findUnique({
      where: { id: wasteData.orderId }
    });
    if (!order) {
      throw new NotFoundError('Pedido');
    }

    // Verificar se product existe
    const product = await this.prisma.product.findUnique({
      where: { id: wasteData.productId }
    });
    if (!product) {
      throw new NotFoundError('Produto');
    }

    // Verificar se material existe
    const material = await this.prisma.material.findUnique({
      where: { id: wasteData.materialId }
    });
    if (!material) {
      throw new NotFoundError('Material');
    }

    // Verificar se component existe
    const component = await this.prisma.productComponent.findUnique({
      where: { id: wasteData.componentId }
    });
    if (!component) {
      throw new NotFoundError('Componente');
    }

    // Verificar se o componente pertence ao produto e material corretos
    if (component.productId !== wasteData.productId || component.materialId !== wasteData.materialId) {
      throw new Error('Componente não pertence ao produto e material especificados');
    }
  }
}
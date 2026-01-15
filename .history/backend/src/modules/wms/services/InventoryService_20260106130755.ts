import { NotFoundError } from '../../../@core/errors/AppError';

interface AddInventoryInput {
  materialId: string;
  width: number;
  length?: number;
  height?: number;
  thickness?: number;
  quantity: number;
  location?: string;
  isOffcut: boolean;
}

interface InventoryFilters {
  materialId?: string;
  location?: string;
  isOffcut?: boolean;
}

export class InventoryService {
  constructor(private prisma: any) {}

  async list(filters: InventoryFilters = {}) {
    const where: any = {};

    if (filters.materialId) {
      where.materialId = filters.materialId;
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.isOffcut !== undefined) {
      where.isOffcut = filters.isOffcut;
    }

    // Só mostrar itens com quantidade > 0
    where.quantity = { gt: 0 };

    return this.prisma.inventoryItem.findMany({
      where,
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            unit: true,
            costPerUnit: true
          }
        },
        _count: {
          select: {
            movements: true
          }
        }
      },
      orderBy: [
        { isOffcut: 'asc' }, // Estoque normal primeiro
        { createdAt: 'desc' }
      ]
    });
  }

  async addItem(data: AddInventoryInput) {
    const item = await this.prisma.inventoryItem.create({
      data: {
        materialId: data.materialId,
        width: data.width,
        length: data.length,
        height: data.height,
        thickness: data.thickness,
        quantity: data.quantity,
        location: data.location,
        isOffcut: data.isOffcut
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            unit: true
          }
        }
      }
    });

    return item;
  }

  async findById(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        material: true,
        movements: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Últimas 10 movimentações
        }
      }
    });

    if (!item) {
      throw new NotFoundError('Item de estoque');
    }

    return item;
  }

  async updateItem(id: string, data: Partial<AddInventoryInput>) {
    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            unit: true
          }
        }
      }
    });

    return item;
  }

  async getStockByMaterial() {
    const result = await this.prisma.inventoryItem.groupBy({
      by: ['materialId', 'isOffcut'],
      where: {
        quantity: { gt: 0 }
      },
      _sum: {
        quantity: true
      },
      _count: {
        id: true
      }
    });

    // Buscar informações dos materiais
    const materialIds = [...new Set(result.map((r: any) => r.materialId))];
    const materials = await this.prisma.material.findMany({
      where: {
        id: { in: materialIds }
      },
      select: {
        id: true,
        name: true,
        format: true,
        unit: true,
        costPerUnit: true
      }
    });

    // Combinar dados
    const report = materials.map((material: any) => {
      const normalStock = result.find((r: any) => r.materialId === material.id && !r.isOffcut);
      const offcutStock = result.find((r: any) => r.materialId === material.id && r.isOffcut);

      return {
        material,
        normalStock: {
          quantity: normalStock?._sum.quantity || 0,
          items: normalStock?._count.id || 0
        },
        offcutStock: {
          quantity: offcutStock?._sum.quantity || 0,
          items: offcutStock?._count.id || 0
        },
        totalQuantity: (normalStock?._sum.quantity || 0) + (offcutStock?._sum.quantity || 0),
        totalValue: ((normalStock?._sum.quantity || 0) + (offcutStock?._sum.quantity || 0)) * Number(material.costPerUnit)
      };
    });

    return report;
  }

  async getOffcuts() {
    return this.prisma.inventoryItem.findMany({
      where: {
        isOffcut: true,
        quantity: { gt: 0 }
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            unit: true,
            costPerUnit: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getAlerts() {
    // Por enquanto, vamos criar alertas simples baseados em quantidade baixa
    const lowStockItems = await this.prisma.inventoryItem.groupBy({
      by: ['materialId'],
      where: {
        isOffcut: false,
        quantity: { gt: 0 }
      },
      _sum: {
        quantity: true
      },
      having: {
        quantity: {
          _sum: {
            lt: 10 // Menos de 10 unidades = estoque baixo
          }
        }
      }
    });

    const materialIds = lowStockItems.map((item: any) => item.materialId);
    const materials = await this.prisma.material.findMany({
      where: {
        id: { in: materialIds }
      },
      select: {
        id: true,
        name: true,
        format: true,
        unit: true
      }
    });

    const alerts = materials.map((material: any) => {
      const stockData = lowStockItems.find((item: any) => item.materialId === material.id);
      return {
        type: 'LOW_STOCK',
        material,
        currentLevel: stockData?._sum.quantity || 0,
        threshold: 10,
        message: `Estoque baixo: ${material.name} (${stockData?._sum.quantity || 0} ${material.unit})`
      };
    });

    return alerts;
  }

  async consumeMaterial(materialId: string, requiredQuantity: number, orderId?: string) {
    // Buscar itens disponíveis do material (FIFO - First In, First Out)
    const availableItems = await this.prisma.inventoryItem.findMany({
      where: {
        materialId,
        quantity: { gt: 0 }
      },
      orderBy: [
        { isOffcut: 'desc' }, // Priorizar retalhos primeiro
        { createdAt: 'asc' }  // Mais antigos primeiro
      ]
    });

    let remainingQuantity = requiredQuantity;
    const consumedItems = [];

    for (const item of availableItems) {
      if (remainingQuantity <= 0) break;

      const consumeFromItem = Math.min(item.quantity, remainingQuantity);
      
      // Atualizar quantidade do item
      await this.prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity - consumeFromItem,
          updatedAt: new Date()
        }
      });

      consumedItems.push({
        itemId: item.id,
        consumed: consumeFromItem
      });

      remainingQuantity -= consumeFromItem;
    }

    if (remainingQuantity > 0) {
      throw new Error(`Estoque insuficiente. Faltam ${remainingQuantity} ${availableItems[0]?.material?.unit || 'unidades'}`);
    }

    return {
      consumed: requiredQuantity,
      items: consumedItems
    };
  }
}
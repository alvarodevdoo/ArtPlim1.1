import { MovementType } from '@prisma/client';

interface CreateMovementInput {
  inventoryItemId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  orderId?: string;
  userId: string;
}

interface MovementFilters {
  materialId?: string;
  type?: MovementType;
  startDate?: string;
  endDate?: string;
}

export class MovementService {
  constructor(private prisma: any) {}

  async create(data: CreateMovementInput) {
    // Verificar se o item de estoque existe
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { id: data.inventoryItemId },
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

    if (!inventoryItem) {
      throw new Error('Item de estoque não encontrado');
    }

    // Validar movimentação
    if (data.type === 'OUT' || data.type === 'WASTE') {
      if (inventoryItem.quantity < data.quantity) {
        throw new Error('Quantidade insuficiente em estoque');
      }
    }

    // Criar movimentação em transação
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Criar registro de movimentação
      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          orderId: data.orderId,
          userId: data.userId
        },
        include: {
          inventoryItem: {
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
          },
          user: {
            select: {
              id: true,
              name: true
            }
          },
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          }
        }
      });

      // Atualizar quantidade do item de estoque
      let newQuantity = inventoryItem.quantity;
      
      switch (data.type) {
        case 'IN':
        case 'ADJUSTMENT':
          newQuantity += data.quantity;
          break;
        case 'OUT':
        case 'WASTE':
          newQuantity -= data.quantity;
          break;
        case 'TRANSFER':
          // Para transferência, a lógica seria mais complexa
          // Por enquanto, tratamos como saída
          newQuantity -= data.quantity;
          break;
      }

      await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          quantity: Math.max(0, newQuantity), // Não permitir quantidade negativa
          updatedAt: new Date()
        }
      });

      return movement;
    });

    return result;
  }

  async list(filters: MovementFilters = {}) {
    const where: any = {};

    if (filters.materialId) {
      where.inventoryItem = {
        materialId: filters.materialId
      };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return this.prisma.inventoryMovement.findMany({
      where,
      include: {
        inventoryItem: {
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
        },
        user: {
          select: {
            id: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getMovementsByMaterial(materialId: string, limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        inventoryItem: {
          materialId
        }
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            width: true,
            length: true,
            height: true,
            location: true,
            isOffcut: true
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  async getMovementStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const stats = await this.prisma.inventoryMovement.groupBy({
      by: ['type'],
      where,
      _count: {
        id: true
      },
      _sum: {
        quantity: true
      }
    });

    return stats.map((stat: any) => ({
      type: stat.type,
      totalMovements: stat._count.id,
      totalQuantity: stat._sum.quantity || 0
    }));
  }
}
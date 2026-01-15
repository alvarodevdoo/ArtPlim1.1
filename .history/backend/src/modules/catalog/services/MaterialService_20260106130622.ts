import { MaterialFormat } from '@prisma/client';
import { NotFoundError } from '../../../@core/errors/AppError';

interface CreateMaterialInput {
  name: string;
  description?: string;
  format: MaterialFormat;
  costPerUnit: number;
  unit: string;
  standardWidth?: number;
  standardLength?: number;
}

export class MaterialService {
  constructor(private prisma: any) {}

  async create(data: CreateMaterialInput) {
    const material = await this.prisma.material.create({
      data: {
        name: data.name,
        description: data.description,
        format: data.format,
        costPerUnit: data.costPerUnit,
        unit: data.unit,
        standardWidth: data.standardWidth,
        standardLength: data.standardLength
      }
    });

    return material;
  }

  async list() {
    return this.prisma.material.findMany({
      where: {
        active: true
      },
      include: {
        inventoryItems: {
          select: {
            id: true,
            width: true,
            length: true,
            height: true,
            quantity: true,
            location: true,
            isOffcut: true
          }
        },
        _count: {
          select: {
            components: true,
            inventoryItems: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findById(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        inventoryItems: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        components: {
          include: {
            product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!material) {
      throw new NotFoundError('Material');
    }

    return material;
  }

  async update(id: string, data: Partial<CreateMaterialInput>) {
    const material = await this.prisma.material.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return material;
  }

  async delete(id: string) {
    // Verificar se o material está sendo usado em produtos
    const usage = await this.prisma.productComponent.findFirst({
      where: { materialId: id }
    });

    if (usage) {
      throw new Error('Material não pode ser removido pois está sendo usado em produtos');
    }

    // Soft delete
    await this.prisma.material.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date()
      }
    });

    return { message: 'Material removido com sucesso' };
  }

  async addInventory(materialId: string, data: {
    width: number;
    length?: number;
    height?: number;
    quantity: number;
    location?: string;
    isOffcut?: boolean;
  }) {
    // Verificar se material existe
    await this.findById(materialId);

    const inventoryItem = await this.prisma.inventoryItem.create({
      data: {
        materialId,
        width: data.width,
        length: data.length,
        height: data.height,
        quantity: data.quantity,
        location: data.location,
        isOffcut: data.isOffcut || false
      }
    });

    return inventoryItem;
  }

  async updateInventory(itemId: string, data: {
    width?: number;
    length?: number;
    height?: number;
    quantity?: number;
    location?: string;
  }) {
    const inventoryItem = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return inventoryItem;
  }

  async removeInventory(itemId: string) {
    await this.prisma.inventoryItem.delete({
      where: { id: itemId }
    });

    return { message: 'Item de estoque removido com sucesso' };
  }

  async getInventorySummary(materialId: string) {
    const material = await this.findById(materialId);
    
    const summary = await this.prisma.inventoryItem.groupBy({
      by: ['isOffcut'],
      where: {
        materialId,
        quantity: {
          gt: 0
        }
      },
      _sum: {
        quantity: true
      },
      _count: {
        id: true
      }
    });

    return {
      material: {
        id: material.id,
        name: material.name,
        format: material.format,
        unit: material.unit
      },
      inventory: summary.map((item: any) => ({
        type: item.isOffcut ? 'Retalhos' : 'Estoque Normal',
        totalQuantity: item._sum.quantity || 0,
        totalItems: item._count.id
      }))
    };
  }
}
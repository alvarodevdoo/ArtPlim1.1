import { MaterialFormat } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreateMaterialInput {
  name: string;
  category?: string;
  description?: string;
  format: MaterialFormat;
  costPerUnit: number;
  unit: string;
  controlUnit?: any;
  conversionFactor?: number;
  width?: number | null;
  height?: number | null;
  defaultConsumptionRule?: any;
  defaultConsumptionFactor?: number;
  inventoryAccountId?: string | null;
  expenseAccountId?: string | null;
  minStockQuantity?: number | null;
  sellWithoutStock?: boolean;
  trackStock?: boolean;
  spedType?: string | null;
  suppliers?: { 
    supplierId: string; 
    costPrice: number; 
    supplierCode?: string;
    paymentTerms?: string | null;
    preferredPaymentDay?: number | null;
  }[];
}

export class MaterialService {
  constructor(private prisma: any) {}

  async create(data: CreateMaterialInput) {
    const material = await this.prisma.material.create({
      data: {
        name: data.name,
        category: data.category || "Outros",
        description: data.description,
        format: data.format,
        costPerUnit: data.costPerUnit,
        unit: data.unit,
        controlUnit: data.controlUnit,
        conversionFactor: data.conversionFactor || 1.0,
        width: data.width,
        height: data.height,
        defaultConsumptionRule: data.defaultConsumptionRule,
        defaultConsumptionFactor: data.defaultConsumptionFactor,
        inventoryAccountId: data.inventoryAccountId,
        expenseAccountId: data.expenseAccountId,
        minStockQuantity: data.minStockQuantity,
        sellWithoutStock: data.sellWithoutStock,
        trackStock: data.trackStock,
        spedType: data.spedType,
        suppliers: data.suppliers?.length ? {
          create: data.suppliers.map(s => ({
            supplierId: s.supplierId,
            costPrice: s.costPrice,
            supplierCode: s.supplierCode,
            paymentTerms: s.paymentTerms,
            preferredPaymentDay: s.preferredPaymentDay
          }))
        } : undefined
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
        suppliers: {
          include: {
            supplier: true
          }
        },
        receiptItems: {
          include: {
            receipt: {
              include: {
                supplier: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
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
    const { suppliers, ..._ } = data;

    return this.prisma.$transaction(async (tx: any) => {
      // Se enviou array de fornecedores, recria os vínculos
      if (suppliers !== undefined) {
        await tx.materialSupplier.deleteMany({
          where: { materialId: id }
        });
      }

      // Mapeamento explícito para garantir que campos novos não sejam descartados pelo Prisma
      const updateFields: any = { updatedAt: new Date() };

      if (data.name !== undefined)                    updateFields.name = data.name;
      if (data.category !== undefined)                updateFields.category = data.category;
      if (data.description !== undefined)             updateFields.description = data.description;
      if (data.format !== undefined)                  updateFields.format = data.format;
      if (data.costPerUnit !== undefined)             updateFields.costPerUnit = data.costPerUnit;
      if (data.unit !== undefined)                    updateFields.unit = data.unit;
      if (data.controlUnit !== undefined)             updateFields.controlUnit = data.controlUnit;
      if (data.conversionFactor !== undefined)        updateFields.conversionFactor = data.conversionFactor;
      if (data.width !== undefined)                   updateFields.width = data.width;
      if (data.height !== undefined)                  updateFields.height = data.height;
      if (data.defaultConsumptionRule !== undefined)  updateFields.defaultConsumptionRule = data.defaultConsumptionRule;
      if (data.defaultConsumptionFactor !== undefined) updateFields.defaultConsumptionFactor = data.defaultConsumptionFactor;
      if (data.inventoryAccountId !== undefined)      updateFields.inventoryAccountId = data.inventoryAccountId;
      if (data.expenseAccountId !== undefined)        updateFields.expenseAccountId = data.expenseAccountId;
      if (data.minStockQuantity !== undefined)        updateFields.minStockQuantity = data.minStockQuantity;
      if (data.sellWithoutStock !== undefined)        updateFields.sellWithoutStock = data.sellWithoutStock;
      if (data.trackStock !== undefined)              updateFields.trackStock = data.trackStock;
      if (data.spedType !== undefined)                updateFields.spedType = data.spedType;

      if (suppliers !== undefined) {
        updateFields.suppliers = {
          create: suppliers.map(s => ({
            supplierId: s.supplierId,
            costPrice: s.costPrice,
            supplierCode: s.supplierCode,
            paymentTerms: s.paymentTerms,
            preferredPaymentDay: s.preferredPaymentDay
          }))
        };
      }

      // ====== [LOG 4] CAMPOS QUE SERAO SALVOS NO PRISMA ======
      console.log('[MAT-SERVICE] updateFields:', JSON.stringify(updateFields, null, 2));

      return tx.material.update({
        where: { id },
        data: updateFields
      });
    });
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
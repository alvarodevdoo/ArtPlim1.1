import { MaterialFormat } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreateMaterialInput {
  name: string;
  categoryId: string;
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
  ncm?: string | null;
  ean?: string | null;
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

  async create(userId: string, organizationId: string, data: CreateMaterialInput) {
    // 1. Busca a categoria para verificar vínculos padrões
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) {
      throw new Error("Categoria não encontrada.");
    }

    // 2. Herança Contábil: Prioriza o que vem do formulário, senão usa o padrão da categoria
    const finalInventoryAccountId = data.inventoryAccountId || category.inventoryAccountId;
    const finalExpenseAccountId = data.expenseAccountId || category.expenseAccountId;

    const material = await this.prisma.material.create({
      data: {
        organizationId,
        name: data.name,
        categoryId: data.categoryId,
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
        inventoryAccountId: finalInventoryAccountId,
        expenseAccountId: finalExpenseAccountId,
        minStockQuantity: data.minStockQuantity,
        sellWithoutStock: data.sellWithoutStock,
        trackStock: data.trackStock,
        ncm: data.ncm,
        ean: data.ean,
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
      },
      include: {
        category: true
      }
    });

    // 4. Registro em Auditoria
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'CREATE_MATERIAL',
        tableName: 'materials',
        recordId: material.id,
        newValues: material as any
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
        category: true,
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

  async update(userId: string, organizationId: string, id: string, data: Partial<CreateMaterialInput>) {
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
      if (data.categoryId !== undefined)              updateFields.categoryId = data.categoryId;
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
      
      let finalInventoryAccountId = data.inventoryAccountId;
      let finalExpenseAccountId = data.expenseAccountId;

      // Herança de Categoria na atualização se a categoria ou as contas estiverem mudando
      if (data.categoryId || finalInventoryAccountId === null || finalExpenseAccountId === null) {
        const materialAtual = await tx.material.findUnique({ where: { id }, select: { categoryId: true } });
        const categoriaParaUsar = data.categoryId || materialAtual?.categoryId;
        if (categoriaParaUsar) {
           const category = await tx.category.findUnique({ where: { id: categoriaParaUsar } });
           if (category) {
              if (finalInventoryAccountId === null || data.inventoryAccountId === undefined) {
                 finalInventoryAccountId = data.inventoryAccountId !== undefined && data.inventoryAccountId !== null ? data.inventoryAccountId : (category.inventoryAccountId || finalInventoryAccountId);
              }
              if (finalExpenseAccountId === null || data.expenseAccountId === undefined) {
                 finalExpenseAccountId = data.expenseAccountId !== undefined && data.expenseAccountId !== null ? data.expenseAccountId : (category.expenseAccountId || finalExpenseAccountId);
              }
           }
        }
      }

      if (finalInventoryAccountId !== undefined)      updateFields.inventoryAccountId = finalInventoryAccountId;
      if (finalExpenseAccountId !== undefined)        updateFields.expenseAccountId = finalExpenseAccountId;

      if (data.minStockQuantity !== undefined)        updateFields.minStockQuantity = data.minStockQuantity;
      if (data.sellWithoutStock !== undefined)        updateFields.sellWithoutStock = data.sellWithoutStock;
      if (data.trackStock !== undefined)              updateFields.trackStock = data.trackStock;
      if (data.ncm !== undefined)                     updateFields.ncm = data.ncm;
      if (data.ean !== undefined)                     updateFields.ean = data.ean;
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

      const oldMaterial = await tx.material.findUnique({ where: { id } });

      const updated = await tx.material.update({
        where: { id },
        data: updateFields
      });

      // Registro em Auditoria
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'UPDATE_MATERIAL',
          tableName: 'materials',
          recordId: id,
          oldValues: oldMaterial as any,
          newValues: updated as any
        }
      });

      return updated;
    });
  }

  async delete(userId: string, organizationId: string, id: string) {
    // Verificar se o material está sendo usado em produtos
    const usage = await this.prisma.productComponent.findFirst({
      where: { materialId: id }
    });

    if (usage) {
      throw new Error('Material não pode ser removido pois está sendo usado em produtos');
    }

    const oldMaterial = await this.prisma.material.findUnique({ where: { id } });

    // Soft delete
    const deleted = await this.prisma.material.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date()
      }
    });

    // Registro em Auditoria
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'DELETE_MATERIAL',
        tableName: 'materials',
        recordId: id,
        oldValues: oldMaterial as any,
        newValues: deleted as any
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
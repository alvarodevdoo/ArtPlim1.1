import { PricingMode } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface CreateProductInput {
  name: string;
  description?: string | null;
  productType?: string;
  pricingMode: PricingMode;
  pricingRuleId?: string | null;
  localFormulaId?: string | null;
  salePrice?: number;
  costPrice?: number;
  organizationId: string;
  // Controle de estoque
  trackStock?: boolean;
  stockQuantity?: number | null;
  stockMinQuantity?: number | null;
  stockUnit?: string | null;
  formulaData?: any;
  customFormula?: string | null;
  categoryId?: string | null;
  revenueAccountId?: string | null;
  targetMarkup?: number | null;
  targetMargin?: number | null;
}

interface UpdateProductInput extends Partial<CreateProductInput> {
  localFormulaId?: string | null;
}

export class ProductService {
  constructor(private prisma: any) { }

  async create(data: CreateProductInput) {
    // Herança Contábil: Se não vier conta, busca o padrão da categoria
    const targetAccountId = data.revenueAccountId || (data.categoryId ? (await this.prisma.category.findUnique({ where: { id: data.categoryId } }))?.chartOfAccountId : null);

    const product = await this.prisma.product.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        name: data.name,
        description: data.description,
        productType: data.productType || 'PRODUCT',
        pricingMode: data.pricingMode,
        ...(data.pricingRuleId ? { pricingRule: { connect: { id: data.pricingRuleId } } } : {}),
        localFormulaId: data.localFormulaId || null,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        formulaData: data.formulaData || null,
        customFormula: data.customFormula || null,
        // Controle de estoque
        trackStock: data.trackStock ?? false,
        stockQuantity: data.trackStock ? (data.stockQuantity ?? null) : null,
        stockMinQuantity: data.trackStock ? (data.stockMinQuantity ?? null) : null,
        stockUnit: data.trackStock ? (data.stockUnit ?? null) : null,
        // Usar relação para evitar problemas com campos escalares no cliente Prisma
        ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
        ...(targetAccountId ? { revenueAccount: { connect: { id: targetAccountId } } } : {})
      } as any
    });

    return product;
  }

  async list(includeStandardSizes: boolean = false) {
    const includeOptions: any = {
      components: {
        include: {
          material: {
            select: {
              id: true,
              name: true,
              format: true,
              costPerUnit: true,
              unit: true
            }
          }
        }
      },
      operations: true,
      pricingRule: true,
      _count: {
        select: {
          orderItems: true
        }
      }
    };

    if (includeStandardSizes) {
      includeOptions.standardSizes = {
        orderBy: {
          isDefault: 'desc'
        }
      };
    }

    return this.prisma.product.findMany({
      where: {
        active: true
      },
      include: includeOptions,
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        components: {
          include: {
            material: true
          }
        },
        operations: true,
        pricingRule: true
      }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    return product;
  }

  async update(id: string, data: Partial<CreateProductInput>) {
    // 1. Verificar se o produto existe
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Produto');
    }

    // Remover campos escalares que o Prisma não reconhece diretamente ou que devem ser tratados como relação
    const { 
      organizationId: _orgId, 
      categoryId, 
      revenueAccountId, 
      pricingRuleId, 
      ...cleanData 
    } = data;

    // Resolver conta de receita (Herança se necessário)
    let revenueAccountConnect = undefined;
    if (categoryId !== undefined || revenueAccountId !== undefined) {
      const finalCategoryId = categoryId !== undefined ? categoryId : existing.categoryId;
      const finalAccountId = revenueAccountId || (finalCategoryId ? (await this.prisma.category.findUnique({ where: { id: finalCategoryId } }))?.chartOfAccountId : null);
      revenueAccountConnect = finalAccountId 
        ? { connect: { id: finalAccountId } } 
        : { disconnect: true };
    }

    try {
      console.log('[PRODUCT-UPDATE] Payload data:', {
        ...cleanData,
        categoryId,
        revenueAccountId,
        pricingRuleId
      });

      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...cleanData,
          // Atualizar Categoria
          ...(categoryId !== undefined ? (
            categoryId ? { category: { connect: { id: categoryId } } } : { category: { disconnect: true } }
          ) : {}),
          
          // Atualizar Conta de Receita (já resolvida acima)
          ...(revenueAccountConnect ? { revenueAccount: revenueAccountConnect } : {}),

          // Re-mapear campos de relação padrão
          ...(pricingRuleId !== undefined ? (
            pricingRuleId ? { pricingRule: { connect: { id: pricingRuleId } } } : { pricingRule: { disconnect: true } }
          ) : {}),
          updatedAt: new Date()
        },
        include: {
          components: {
            include: {
              material: true
            }
          },
          operations: true,
          pricingRule: true
        }
      });

      return product;
    } catch (err) {
      console.error('[PRODUCT-UPDATE] ERROR:', err);
      throw err;
    }
  }

  async delete(id: string) {
    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date()
      }
    });

    return { message: 'Produto removido com sucesso' };
  }

  async addComponent(productId: string, materialId: string, consumptionMethod: string, wastePercentage: number = 0.1) {
    // Verificar se produto existe
    const product = await this.findById(productId);

    // Verificar se material existe
    const material = await this.prisma.material.findUnique({
      where: { id: materialId }
    });

    if (!material) {
      throw new NotFoundError('Material');
    }

    const component = await this.prisma.productComponent.create({
      data: {
        productId,
        materialId,
        consumptionMethod,
        wastePercentage
      },
      include: {
        material: true
      }
    });

    return component;
  }

  async removeComponent(productId: string, componentId: string) {
    await this.prisma.productComponent.delete({
      where: {
        id: componentId,
        productId // Garantir que o componente pertence ao produto
      }
    });

    return { message: 'Componente removido com sucesso' };
  }

  async addOperation(productId: string, name: string, costPerMinute: number, setupTime: number = 0) {
    // Verificar se produto existe
    await this.findById(productId);

    const operation = await this.prisma.productOperation.create({
      data: {
        productId,
        name,
        costPerMinute,
        setupTime
      }
    });

    return operation;
  }

  async removeOperation(productId: string, operationId: string) {
    await this.prisma.productOperation.delete({
      where: {
        id: operationId,
        productId // Garantir que a operação pertence ao produto
      }
    });

    return { message: 'Operação removida com sucesso' };
  }
}
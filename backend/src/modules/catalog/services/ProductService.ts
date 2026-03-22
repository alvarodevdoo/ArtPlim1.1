import { PricingMode } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface CreateProductInput {
  name: string;
  description?: string;
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
}

interface UpdateProductInput extends Partial<CreateProductInput> {
  localFormulaId?: string | null;
}

export class ProductService {
  constructor(private prisma: any) { }

  async create(data: CreateProductInput) {
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
        stockUnit: data.trackStock ? (data.stockUnit ?? null) : null
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

    // Destructuring para remover organizationId do update do Prisma
    const { organizationId: _orgId, ...updateData } = data;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        pricingRuleId: undefined, // Remover campo escalar para usar relação
        ...(data.pricingRuleId !== undefined ? (
          data.pricingRuleId ? { pricingRule: { connect: { id: data.pricingRuleId } } } : { pricingRule: { disconnect: true } }
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
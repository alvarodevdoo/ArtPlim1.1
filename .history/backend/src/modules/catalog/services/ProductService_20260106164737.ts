import { PricingMode } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../@core/errors/AppError';

interface CreateProductInput {
  name: string;
  description?: string;
  pricingMode: PricingMode;
  salePrice?: number;
  minPrice?: number;
  markup: number;
  organizationId: string; // Adicionar organizationId para validação
}

export class ProductService {
  constructor(private prisma: any) {}

  private async validateEngineeringMode(organizationId: string, pricingMode: PricingMode) {
    if (pricingMode === 'DYNAMIC_ENGINEER') {
      // Buscar configurações da organização
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId }
      });

      // Se não há configurações ou a engenharia está desabilitada
      if (!settings || !settings.enableEngineering) {
        throw new ValidationError(
          'O modo de precificação "Engenharia Dinâmica" não está disponível. ' +
          'Ative o módulo de Engenharia de Produto nas configurações do sistema.'
        );
      }
    }
  }

  async create(data: CreateProductInput) {
    // Validar se o modo de engenharia está habilitado
    await this.validateEngineeringMode(data.organizationId, data.pricingMode);

    const product = await this.prisma.product.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        pricingMode: data.pricingMode,
        salePrice: data.salePrice,
        minPrice: data.minPrice,
        markup: data.markup
      }
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
        operations: true
      }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    return product;
  }

  async update(id: string, data: Partial<CreateProductInput>) {
    // Se está tentando alterar o modo de precificação, validar
    if (data.pricingMode && data.organizationId) {
      await this.validateEngineeringMode(data.organizationId, data.pricingMode);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        components: {
          include: {
            material: true
          }
        },
        operations: true
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
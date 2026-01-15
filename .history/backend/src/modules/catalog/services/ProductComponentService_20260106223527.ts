import { MaterialFormat } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../@core/errors/AppError';

interface CreateComponentRequest {
  materialId: string;
  consumptionMethod: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT';
  wastePercentage?: number;
  manualWastePercentage?: number;
  isOptional?: boolean;
  priority?: number;
  notes?: string;
}

interface UpdateComponentRequest {
  consumptionMethod?: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT';
  wastePercentage?: number;
  manualWastePercentage?: number;
  isOptional?: boolean;
  priority?: number;
  notes?: string;
}

export class ProductComponentService {
  constructor(private prisma: any) {}

  /**
   * Valida se o método de consumo é compatível com o formato do material
   */
  private async validateComponentCompatibility(materialId: string, consumptionMethod: string): Promise<boolean> {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { format: true }
    });

    if (!material) {
      throw new NotFoundError('Material');
    }

    // Regras de compatibilidade
    const compatibilityRules: Record<string, MaterialFormat[]> = {
      BOUNDING_BOX: [MaterialFormat.SHEET], // Apenas chapas
      LINEAR_NEST: [MaterialFormat.ROLL],   // Apenas rolos
      FIXED_AMOUNT: [MaterialFormat.UNIT, MaterialFormat.ROLL, MaterialFormat.SHEET] // Qualquer formato
    };

    const allowedFormats = compatibilityRules[consumptionMethod];
    return allowedFormats?.includes(material.format) || false;
  }

  /**
   * Adiciona um componente ao produto
   */
  async addComponent(productId: string, request: CreateComponentRequest) {
    // Verificar se produto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    // Verificar se material existe
    const material = await this.prisma.material.findUnique({
      where: { id: request.materialId }
    });

    if (!material) {
      throw new NotFoundError('Material');
    }

    // Validar compatibilidade
    const isCompatible = await this.validateComponentCompatibility(
      request.materialId, 
      request.consumptionMethod
    );

    if (!isCompatible) {
      throw new ValidationError(
        `Método de consumo ${request.consumptionMethod} não é compatível com material do tipo ${material.format}`
      );
    }

    // Verificar se já existe componente com este material
    const existingComponent = await this.prisma.productComponent.findFirst({
      where: {
        productId,
        materialId: request.materialId
      }
    });

    if (existingComponent) {
      throw new ValidationError('Este material já está vinculado ao produto');
    }

    // Criar componente
    const component = await this.prisma.productComponent.create({
      data: {
        productId,
        materialId: request.materialId,
        consumptionMethod: request.consumptionMethod,
        wastePercentage: request.wastePercentage || 0.0,
        manualWastePercentage: request.manualWastePercentage,
        isOptional: request.isOptional || false,
        priority: request.priority || 1,
        notes: request.notes
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            costPerUnit: true,
            unit: true,
            standardWidth: true,
            standardLength: true
          }
        }
      }
    });

    return component;
  }

  /**
   * Remove um componente do produto
   */
  async removeComponent(productId: string, componentId: string) {
    // Verificar se o componente existe e pertence ao produto
    const component = await this.prisma.productComponent.findFirst({
      where: {
        id: componentId,
        productId
      }
    });

    if (!component) {
      throw new NotFoundError('Componente não encontrado ou não pertence ao produto');
    }

    // Remover componente
    await this.prisma.productComponent.delete({
      where: { id: componentId }
    });

    return { message: 'Componente removido com sucesso' };
  }

  /**
   * Lista todos os componentes de um produto
   */
  async listComponents(productId: string) {
    // Verificar se produto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    const components = await this.prisma.productComponent.findMany({
      where: { productId },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            format: true,
            costPerUnit: true,
            unit: true,
            standardWidth: true,
            standardLength: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return components;
  }

  /**
   * Atualiza um componente
   */
  async updateComponent(componentId: string, data: UpdateComponentRequest) {
    // Verificar se componente existe
    const existingComponent = await this.prisma.productComponent.findUnique({
      where: { id: componentId },
      include: { material: true }
    });

    if (!existingComponent) {
      throw new NotFoundError('Componente');
    }

    // Se está alterando o método de consumo, validar compatibilidade
    if (data.consumptionMethod) {
      const isCompatible = await this.validateComponentCompatibility(
        existingComponent.materialId,
        data.consumptionMethod
      );

      if (!isCompatible) {
        throw new ValidationError(
          `Método de consumo ${data.consumptionMethod} não é compatível com material do tipo ${existingComponent.material.format}`
        );
      }
    }

    // Atualizar componente
    const component = await this.prisma.productComponent.update({
      where: { id: componentId },
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
            costPerUnit: true,
            unit: true,
            standardWidth: true,
            standardLength: true
          }
        }
      }
    });

    return component;
  }

  /**
   * Valida se um produto tem componentes obrigatórios para modo DYNAMIC_ENGINEER
   */
  async validateProductConfiguration(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        components: true
      }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    const errors: string[] = [];

    // Se é modo DYNAMIC_ENGINEER, deve ter pelo menos um material
    if (product.pricingMode === 'DYNAMIC_ENGINEER') {
      if (product.components.length === 0) {
        errors.push('Produtos com modo "Engenharia Dinâmica" devem ter pelo menos um material configurado');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtém estatísticas de uso de um material
   */
  async getMaterialUsageStats(materialId: string) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId }
    });

    if (!material) {
      throw new NotFoundError('Material');
    }

    const stats = await this.prisma.productComponent.findMany({
      where: { materialId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            pricingMode: true,
            active: true
          }
        }
      }
    });

    return {
      material: {
        id: material.id,
        name: material.name,
        format: material.format
      },
      usageCount: stats.length,
      products: stats.map(component => ({
        productId: component.product.id,
        productName: component.product.name,
        consumptionMethod: component.consumptionMethod,
        wastePercentage: component.wastePercentage,
        isActive: component.product.active
      }))
    };
  }
}
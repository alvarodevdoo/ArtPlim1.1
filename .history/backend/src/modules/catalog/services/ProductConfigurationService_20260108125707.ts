import { ConfigurationType } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface CreateConfigurationRequest {
  name: string;
  type: ConfigurationType;
  required?: boolean;
  defaultValue?: string;
  affectsComponents?: boolean;
  affectsPricing?: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  displayOrder?: number;
  description?: string;
  helpText?: string;
}

interface UpdateConfigurationRequest {
  name?: string;
  type?: ConfigurationType;
  required?: boolean;
  defaultValue?: string;
  affectsComponents?: boolean;
  affectsPricing?: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  displayOrder?: number;
  description?: string;
  helpText?: string;
}

interface CreateOptionRequest {
  label: string;
  value: string;
  description?: string;
  priceModifier?: number;
  priceModifierType?: 'FIXED' | 'PERCENTAGE';
  additionalComponents?: AdditionalComponent[];
  removedComponents?: string[];
  componentModifiers?: ComponentModifier[];
  displayOrder?: number;
  isAvailable?: boolean;
}

interface UpdateOptionRequest {
  label?: string;
  value?: string;
  description?: string;
  priceModifier?: number;
  priceModifierType?: 'FIXED' | 'PERCENTAGE';
  additionalComponents?: AdditionalComponent[];
  removedComponents?: string[];
  componentModifiers?: ComponentModifier[];
  displayOrder?: number;
  isAvailable?: boolean;
}

interface AdditionalComponent {
  materialId: string;
  consumptionMethod: string;
  quantity: number;
  wastePercentage: number;
  isOptional: boolean;
}

interface ComponentModifier {
  componentId: string;
  modificationType: 'MULTIPLY' | 'ADD' | 'REPLACE';
  value: number;
  unit?: string;
}

interface ConfigurationTemplate {
  id?: string;
  organizationId: string;
  name: string;
  description?: string;
  category: string;
  configurations: any[];
  metadata: {
    version: string;
    createdBy: string;
    productType?: string;
    tags?: string[];
  };
}

interface ConfigurationExport {
  version: string;
  productId: string;
  productName: string;
  exportedAt: Date;
  exportedBy: string;
  configurations: any[];
  checksum: string;
}

interface ConfigurationImport {
  version: string;
  configurations: any[];
  options: {
    overwriteExisting: boolean;
    preserveIds: boolean;
    validateIntegrity: boolean;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

interface IntegrityResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

export class ProductConfigurationService {
  constructor(private prisma: any) {}

  /**
   * Cria uma nova configuração para um produto
   */
  async createConfiguration(productId: string, request: CreateConfigurationRequest) {
    // Verificar se produto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    // Validar dados específicos por tipo
    this.validateConfigurationData(request);

    // Verificar se já existe configuração com o mesmo nome
    const existingConfig = await this.prisma.productConfiguration.findFirst({
      where: {
        productId,
        name: request.name
      }
    });

    if (existingConfig) {
      throw new ValidationError('Já existe uma configuração com este nome para o produto');
    }

    const configuration = await this.prisma.productConfiguration.create({
      data: {
        productId,
        name: request.name,
        type: request.type,
        required: request.required ?? true,
        defaultValue: request.defaultValue,
        affectsComponents: request.affectsComponents ?? false,
        affectsPricing: request.affectsPricing ?? false,
        minValue: request.minValue,
        maxValue: request.maxValue,
        step: request.step,
        displayOrder: request.displayOrder ?? 1
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    return configuration;
  }

  /**
   * Lista todas as configurações de um produto
   */
  async listConfigurations(productId: string) {
    // Verificar se produto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    const configurations = await this.prisma.productConfiguration.findMany({
      where: { productId },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    return configurations;
  }

  /**
   * Obtém uma configuração específica
   */
  async getConfiguration(configurationId: string) {
    const configuration = await this.prisma.productConfiguration.findUnique({
      where: { id: configurationId },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' }
        },
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!configuration) {
      throw new NotFoundError('Configuração');
    }

    return configuration;
  }

  /**
   * Atualiza uma configuração
   */
  async updateConfiguration(configurationId: string, request: UpdateConfigurationRequest) {
    // Verificar se configuração existe
    const existingConfig = await this.prisma.productConfiguration.findUnique({
      where: { id: configurationId }
    });

    if (!existingConfig) {
      throw new NotFoundError('Configuração');
    }

    // Validar dados se o tipo está sendo alterado
    if (request.type) {
      this.validateConfigurationData({ ...existingConfig, ...request } as CreateConfigurationRequest);
    }

    const configuration = await this.prisma.productConfiguration.update({
      where: { id: configurationId },
      data: {
        ...request,
        updatedAt: new Date()
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    return configuration;
  }

  /**
   * Remove uma configuração
   */
  async deleteConfiguration(configurationId: string) {
    // Verificar se configuração existe
    const configuration = await this.prisma.productConfiguration.findUnique({
      where: { id: configurationId }
    });

    if (!configuration) {
      throw new NotFoundError('Configuração');
    }

    // Remover configuração (cascade remove as opções)
    await this.prisma.productConfiguration.delete({
      where: { id: configurationId }
    });

    return { message: 'Configuração removida com sucesso' };
  }

  /**
   * Adiciona uma opção a uma configuração SELECT
   */
  async addOption(configurationId: string, request: CreateOptionRequest) {
    // Verificar se configuração existe e é do tipo SELECT
    const configuration = await this.prisma.productConfiguration.findUnique({
      where: { id: configurationId }
    });

    if (!configuration) {
      throw new NotFoundError('Configuração');
    }

    if (configuration.type !== ConfigurationType.SELECT) {
      throw new ValidationError('Opções só podem ser adicionadas a configurações do tipo SELECT');
    }

    // Verificar se já existe opção com o mesmo valor
    const existingOption = await this.prisma.configurationOption.findFirst({
      where: {
        configurationId,
        value: request.value
      }
    });

    if (existingOption) {
      throw new ValidationError('Já existe uma opção com este valor para a configuração');
    }

    const option = await this.prisma.configurationOption.create({
      data: {
        configurationId,
        label: request.label,
        value: request.value,
        priceModifier: request.priceModifier ?? 0,
        additionalComponents: request.additionalComponents ? JSON.stringify(request.additionalComponents) : null,
        removedComponents: request.removedComponents ? JSON.stringify(request.removedComponents) : null,
        componentModifiers: request.componentModifiers ? JSON.stringify(request.componentModifiers) : null,
        displayOrder: request.displayOrder ?? 1
      }
    });

    return option;
  }

  /**
   * Atualiza uma opção
   */
  async updateOption(optionId: string, request: UpdateOptionRequest) {
    // Verificar se opção existe
    const existingOption = await this.prisma.configurationOption.findUnique({
      where: { id: optionId }
    });

    if (!existingOption) {
      throw new NotFoundError('Opção');
    }

    const option = await this.prisma.configurationOption.update({
      where: { id: optionId },
      data: {
        label: request.label,
        value: request.value,
        priceModifier: request.priceModifier,
        additionalComponents: request.additionalComponents ? JSON.stringify(request.additionalComponents) : undefined,
        removedComponents: request.removedComponents ? JSON.stringify(request.removedComponents) : undefined,
        componentModifiers: request.componentModifiers ? JSON.stringify(request.componentModifiers) : undefined,
        displayOrder: request.displayOrder,
        updatedAt: new Date()
      }
    });

    return option;
  }

  /**
   * Remove uma opção
   */
  async deleteOption(optionId: string) {
    // Verificar se opção existe
    const option = await this.prisma.configurationOption.findUnique({
      where: { id: optionId }
    });

    if (!option) {
      throw new NotFoundError('Opção');
    }

    await this.prisma.configurationOption.delete({
      where: { id: optionId }
    });

    return { message: 'Opção removida com sucesso' };
  }

  /**
   * Valida os dados de uma configuração baseado no tipo
   */
  private validateConfigurationData(data: CreateConfigurationRequest) {
    switch (data.type) {
      case ConfigurationType.NUMBER:
        if (data.minValue !== undefined && data.maxValue !== undefined && data.minValue >= data.maxValue) {
          throw new ValidationError('Valor mínimo deve ser menor que o valor máximo');
        }
        if (data.step !== undefined && data.step <= 0) {
          throw new ValidationError('Step deve ser maior que zero');
        }
        break;

      case ConfigurationType.SELECT:
        // Para SELECT, as validações são feitas nas opções
        break;

      case ConfigurationType.BOOLEAN:
        // Para BOOLEAN, defaultValue deve ser 'true' ou 'false'
        if (data.defaultValue && !['true', 'false'].includes(data.defaultValue)) {
          throw new ValidationError('Valor padrão para configuração BOOLEAN deve ser "true" ou "false"');
        }
        break;

      case ConfigurationType.TEXT:
        // Para TEXT, não há validações específicas
        break;

      default:
        throw new ValidationError('Tipo de configuração inválido');
    }
  }

  /**
   * Obtém todas as configurações de um produto com suas opções
   */
  async getProductConfigurations(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        configurations: {
          include: {
            options: {
              orderBy: { displayOrder: 'asc' }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    return {
      product: {
        id: product.id,
        name: product.name,
        pricingMode: product.pricingMode
      },
      configurations: product.configurations
    };
  }

  /**
   * Valida se as configurações selecionadas são válidas para um produto
   */
  async validateSelectedConfigurations(productId: string, selectedConfigs: Record<string, any>) {
    const configurations = await this.listConfigurations(productId);
    const errors: string[] = [];

    for (const config of configurations) {
      const selectedValue = selectedConfigs[config.id];

      // Verificar configurações obrigatórias
      if (config.required && (selectedValue === undefined || selectedValue === null || selectedValue === '')) {
        errors.push(`Configuração "${config.name}" é obrigatória`);
        continue;
      }

      // Validar por tipo
      if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
        switch (config.type) {
          case ConfigurationType.NUMBER:
            const numValue = Number(selectedValue);
            if (isNaN(numValue)) {
              errors.push(`Configuração "${config.name}" deve ser um número`);
            } else {
              if (config.minValue !== null && numValue < config.minValue) {
                errors.push(`Configuração "${config.name}" deve ser maior ou igual a ${config.minValue}`);
              }
              if (config.maxValue !== null && numValue > config.maxValue) {
                errors.push(`Configuração "${config.name}" deve ser menor ou igual a ${config.maxValue}`);
              }
              if (config.step && config.step > 0) {
                const remainder = (numValue - (config.minValue || 0)) % config.step;
                if (Math.abs(remainder) > 0.001) {
                  errors.push(`Configuração "${config.name}" deve ser múltiplo de ${config.step}`);
                }
              }
            }
            break;

          case ConfigurationType.SELECT:
            const validOption = config.options.find((opt: any) => opt.value === selectedValue);
            if (!validOption) {
              errors.push(`Valor "${selectedValue}" não é válido para configuração "${config.name}"`);
            }
            break;

          case ConfigurationType.BOOLEAN:
            if (!['true', 'false'].includes(String(selectedValue))) {
              errors.push(`Configuração "${config.name}" deve ser true ou false`);
            }
            break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
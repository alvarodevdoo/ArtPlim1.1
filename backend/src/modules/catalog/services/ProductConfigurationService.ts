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
  constructor(private prisma: any) { }

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
  async validateSelectedConfigurations(productId: string, selectedConfigs: Record<string, any>): Promise<ValidationResult> {
    const configurations = await this.listConfigurations(productId);
    const errors: string[] = [];
    const warnings: string[] = [];

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
            } else if (!validOption.isAvailable) {
              warnings.push(`Opção "${validOption.label}" para configuração "${config.name}" não está disponível`);
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
      errors,
      warnings
    };
  }

  /**
   * Valida a integridade de uma configuração
   */
  async validateConfigurationIntegrity(configurationId: string): Promise<IntegrityResult> {
    const configuration = await this.getConfiguration(configurationId);
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Verificar se configuração SELECT tem opções
    if (configuration.type === ConfigurationType.SELECT && configuration.options.length === 0) {
      issues.push('Configuração do tipo SELECT deve ter pelo menos uma opção');
      suggestions.push('Adicione opções para esta configuração');
    }

    // Verificar se opções têm valores únicos
    if (configuration.type === ConfigurationType.SELECT) {
      const values = configuration.options.map((opt: any) => opt.value);
      const uniqueValues = new Set(values);
      if (values.length !== uniqueValues.size) {
        issues.push('Configuração possui opções com valores duplicados');
        suggestions.push('Certifique-se de que cada opção tenha um valor único');
      }
    }

    // Verificar se componentes adicionais existem
    for (const option of configuration.options) {
      if (option.additionalComponents) {
        const additionalComponents = JSON.parse(option.additionalComponents);
        for (const component of additionalComponents) {
          const material = await this.prisma.material.findUnique({
            where: { id: component.materialId }
          });
          if (!material) {
            issues.push(`Material ${component.materialId} referenciado na opção "${option.label}" não existe`);
            suggestions.push('Remova ou substitua materiais inexistentes');
          }
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Reordena opções de uma configuração
   */
  async reorderOptions(configurationId: string, optionIds: string[]): Promise<void> {
    const configuration = await this.prisma.productConfiguration.findUnique({
      where: { id: configurationId },
      include: { options: true }
    });

    if (!configuration) {
      throw new NotFoundError('Configuração');
    }

    // Verificar se todos os IDs são válidos
    const existingOptionIds = configuration.options.map((opt: any) => opt.id);
    const invalidIds = optionIds.filter(id => !existingOptionIds.includes(id));
    if (invalidIds.length > 0) {
      throw new ValidationError(`Opções inválidas: ${invalidIds.join(', ')}`);
    }

    // Atualizar ordem das opções
    for (let i = 0; i < optionIds.length; i++) {
      await this.prisma.configurationOption.update({
        where: { id: optionIds[i] },
        data: { displayOrder: i + 1 }
      });
    }
  }

  /**
   * Duplica uma configuração para outro produto
   */
  async duplicateConfiguration(configurationId: string, targetProductId: string): Promise<any> {
    const sourceConfig = await this.getConfiguration(configurationId);

    // Verificar se produto de destino existe
    const targetProduct = await this.prisma.product.findUnique({
      where: { id: targetProductId }
    });

    if (!targetProduct) {
      throw new NotFoundError('Produto de destino');
    }

    // Criar nova configuração
    const newConfig = await this.createConfiguration(targetProductId, {
      name: `${sourceConfig.name} (Cópia)`,
      type: sourceConfig.type,
      required: sourceConfig.required,
      defaultValue: sourceConfig.defaultValue,
      affectsComponents: sourceConfig.affectsComponents,
      affectsPricing: sourceConfig.affectsPricing,
      minValue: sourceConfig.minValue,
      maxValue: sourceConfig.maxValue,
      step: sourceConfig.step,
      displayOrder: sourceConfig.displayOrder,
      description: sourceConfig.description,
      helpText: sourceConfig.helpText
    });

    // Duplicar opções se for SELECT
    if (sourceConfig.type === ConfigurationType.SELECT) {
      for (const option of sourceConfig.options) {
        await this.addOption(newConfig.id, {
          label: option.label,
          value: option.value,
          description: option.description,
          priceModifier: option.priceModifier,
          priceModifierType: option.priceModifierType || 'FIXED',
          additionalComponents: option.additionalComponents ? JSON.parse(option.additionalComponents) : [],
          removedComponents: option.removedComponents ? JSON.parse(option.removedComponents) : [],
          componentModifiers: option.componentModifiers ? JSON.parse(option.componentModifiers) : [],
          displayOrder: option.displayOrder,
          isAvailable: option.isAvailable ?? true
        });
      }
    }

    return newConfig;
  }

  /**
   * Cria um template a partir das configurações de um produto
   */
  async createTemplate(productId: string, templateName: string, userId: string): Promise<ConfigurationTemplate> {
    const productConfigs = await this.getProductConfigurations(productId);

    // Get the product to access organizationId
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { organizationId: true }
    });

    if (!product) {
      throw new NotFoundError('Produto');
    }

    const template: ConfigurationTemplate = {
      organizationId: product.organizationId,
      name: templateName,
      description: `Template criado a partir do produto ${productConfigs.product.name}`,
      category: 'custom',
      configurations: productConfigs.configurations,
      metadata: {
        version: '1.0',
        createdBy: userId,
        productType: productConfigs.product.pricingMode,
        tags: ['custom', 'template']
      }
    };

    // Salvar template no banco
    const savedTemplate = await this.prisma.configurationTemplate.create({
      data: {
        organizationId: template.organizationId,
        name: template.name,
        description: template.description,
        category: template.category,
        configurations: JSON.stringify(template.configurations),
        metadata: JSON.stringify(template.metadata),
        createdBy: userId
      }
    });

    return { ...template, id: savedTemplate.id };
  }

  /**
   * Aplica um template a um produto
   */
  async applyTemplate(productId: string, templateId: string): Promise<any[]> {
    const template = await this.prisma.configurationTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    const configurations = JSON.parse(template.configurations);
    const createdConfigurations = [];

    for (const config of configurations) {
      // Criar configuração
      const newConfig = await this.createConfiguration(productId, {
        name: config.name,
        type: config.type,
        required: config.required,
        defaultValue: config.defaultValue,
        affectsComponents: config.affectsComponents,
        affectsPricing: config.affectsPricing,
        minValue: config.minValue,
        maxValue: config.maxValue,
        step: config.step,
        displayOrder: config.displayOrder,
        description: config.description,
        helpText: config.helpText
      });

      // Criar opções se for SELECT
      if (config.type === ConfigurationType.SELECT && config.options) {
        for (const option of config.options) {
          await this.addOption(newConfig.id, {
            label: option.label,
            value: option.value,
            description: option.description,
            priceModifier: option.priceModifier,
            priceModifierType: option.priceModifierType || 'FIXED',
            additionalComponents: option.additionalComponents ? JSON.parse(option.additionalComponents) : [],
            removedComponents: option.removedComponents ? JSON.parse(option.removedComponents) : [],
            componentModifiers: option.componentModifiers ? JSON.parse(option.componentModifiers) : [],
            displayOrder: option.displayOrder,
            isAvailable: option.isAvailable ?? true
          });
        }
      }

      createdConfigurations.push(newConfig);
    }

    // Incrementar contador de uso do template
    await this.prisma.configurationTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } }
    });

    return createdConfigurations;
  }

  /**
   * Lista templates disponíveis para uma organização
   */
  async listTemplates(organizationId: string): Promise<ConfigurationTemplate[]> {
    const templates = await this.prisma.configurationTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });

    return templates.map((template: any) => ({
      id: template.id,
      organizationId: template.organizationId,
      name: template.name,
      description: template.description,
      category: template.category,
      configurations: JSON.parse(template.configurations),
      metadata: JSON.parse(template.metadata)
    }));
  }

  /**
   * Exporta configurações de um produto
   */
  async exportConfigurations(productId: string, userId: string): Promise<ConfigurationExport> {
    const productConfigs = await this.getProductConfigurations(productId);

    const exportData: ConfigurationExport = {
      version: '1.0',
      productId: productConfigs.product.id,
      productName: productConfigs.product.name,
      exportedAt: new Date(),
      exportedBy: userId,
      configurations: productConfigs.configurations,
      checksum: this.generateChecksum(productConfigs.configurations)
    };

    return exportData;
  }

  /**
   * Importa configurações para um produto
   */
  async importConfigurations(productId: string, importData: ConfigurationImport): Promise<any[]> {
    // Validar integridade dos dados
    if (importData.options.validateIntegrity) {
      const checksum = this.generateChecksum(importData.configurations);
      // Aqui você poderia validar o checksum se estivesse incluído nos dados
    }

    const createdConfigurations = [];

    for (const config of importData.configurations) {
      try {
        // Verificar se configuração já existe
        if (!importData.options.overwriteExisting) {
          const existing = await this.prisma.productConfiguration.findFirst({
            where: {
              productId,
              name: config.name
            }
          });

          if (existing) {
            continue; // Pular se já existe e não deve sobrescrever
          }
        }

        // Criar configuração
        const newConfig = await this.createConfiguration(productId, {
          name: config.name,
          type: config.type,
          required: config.required,
          defaultValue: config.defaultValue,
          affectsComponents: config.affectsComponents,
          affectsPricing: config.affectsPricing,
          minValue: config.minValue,
          maxValue: config.maxValue,
          step: config.step,
          displayOrder: config.displayOrder,
          description: config.description,
          helpText: config.helpText
        });

        // Importar opções se for SELECT
        if (config.type === ConfigurationType.SELECT && config.options) {
          for (const option of config.options) {
            await this.addOption(newConfig.id, {
              label: option.label,
              value: option.value,
              description: option.description,
              priceModifier: option.priceModifier,
              priceModifierType: option.priceModifierType || 'FIXED',
              additionalComponents: option.additionalComponents || [],
              removedComponents: option.removedComponents || [],
              componentModifiers: option.componentModifiers || [],
              displayOrder: option.displayOrder,
              isAvailable: option.isAvailable ?? true
            });
          }
        }

        createdConfigurations.push(newConfig);
      } catch (error) {
        // Log error but continue with other configurations
        console.error(`Erro ao importar configuração ${config.name}:`, error);
      }
    }

    return createdConfigurations;
  }

  /**
   * Gera checksum para validação de integridade
   */
  private generateChecksum(data: any): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
}
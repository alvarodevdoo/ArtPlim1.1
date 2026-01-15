import { ConfigurationType } from '@prisma/client';
import { ValidationError } from '../../../shared/infrastructure/errors/AppError';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

interface ConflictResult {
  hasConflicts: boolean;
  conflicts: ConfigurationConflict[];
}

interface ConfigurationConflict {
  type: 'DEPENDENCY' | 'MATERIAL' | 'PRICING' | 'PRODUCTION';
  message: string;
  affectedConfigurations: string[];
  severity: 'ERROR' | 'WARNING';
}

interface ResolutionSuggestion {
  conflictId: string;
  suggestion: string;
  action: 'CHANGE_VALUE' | 'ADD_MATERIAL' | 'REMOVE_OPTION' | 'ADJUST_PRICING';
  parameters?: Record<string, any>;
}

interface ConfigurationSelections {
  [configurationId: string]: any;
}

interface NumberConfiguration {
  id: string;
  name: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  required: boolean;
}

interface SelectConfiguration {
  id: string;
  name: string;
  required: boolean;
  options: Array<{
    id: string;
    value: string;
    label: string;
    isAvailable: boolean;
  }>;
}

export class ConfigurationValidationService {
  constructor(private prisma: any) {}

  /**
   * Valida configurações obrigatórias
   */
  async validateRequiredConfigurations(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const configurations = await this.prisma.productConfiguration.findMany({
      where: { productId, required: true },
      select: { id: true, name: true, required: true }
    });

    const errors: string[] = [];

    for (const config of configurations) {
      const selectedValue = selections[config.id];
      
      if (selectedValue === undefined || selectedValue === null || selectedValue === '') {
        errors.push(`Configuração obrigatória "${config.name}" não foi selecionada`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida restrições de configurações numéricas
   */
  async validateNumberConstraints(
    config: NumberConfiguration, 
    value: number
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isNaN(value)) {
      errors.push(`Valor para "${config.name}" deve ser um número válido`);
      return { isValid: false, errors, warnings };
    }

    // Validar valor mínimo
    if (config.minValue !== undefined && value < config.minValue) {
      errors.push(`Valor para "${config.name}" deve ser maior ou igual a ${config.minValue}`);
    }

    // Validar valor máximo
    if (config.maxValue !== undefined && value > config.maxValue) {
      errors.push(`Valor para "${config.name}" deve ser menor ou igual a ${config.maxValue}`);
    }

    // Validar incremento (step)
    if (config.step && config.step > 0 && config.minValue !== undefined) {
      const remainder = (value - config.minValue) % config.step;
      if (Math.abs(remainder) > 0.001) {
        errors.push(`Valor para "${config.name}" deve ser múltiplo de ${config.step} a partir de ${config.minValue}`);
      }
    }

    // Avisos para valores próximos aos limites
    if (config.maxValue !== undefined && value > config.maxValue * 0.9) {
      warnings.push(`Valor para "${config.name}" está próximo ao limite máximo`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida opções de configurações SELECT
   */
  async validateSelectOptions(
    config: SelectConfiguration, 
    value: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar se a opção existe
    const selectedOption = config.options.find(opt => opt.value === value);
    
    if (!selectedOption) {
      errors.push(`Valor "${value}" não é uma opção válida para "${config.name}"`);
      return { isValid: false, errors, warnings };
    }

    // Verificar se a opção está disponível
    if (!selectedOption.isAvailable) {
      errors.push(`Opção "${selectedOption.label}" para "${config.name}" não está disponível no momento`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida dependências entre configurações
   */
  async validateDependencies(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Buscar configurações com dependências
    const configurations = await this.prisma.productConfiguration.findMany({
      where: { productId },
      include: {
        options: {
          where: { isAvailable: true }
        }
      }
    });

    // Implementar lógica de dependências específicas do negócio
    // Por exemplo: se "Encadernação" = "Espiral", então "Número de Páginas" deve ser múltiplo de 4
    for (const config of configurations) {
      if (config.name === 'Encadernação' && selections[config.id] === 'espiral') {
        const pagesConfig = configurations.find(c => c.name === 'Número de Páginas');
        if (pagesConfig && selections[pagesConfig.id]) {
          const pages = Number(selections[pagesConfig.id]);
          if (pages % 4 !== 0) {
            errors.push('Para encadernação espiral, o número de páginas deve ser múltiplo de 4');
          }
        }
      }

      // Exemplo: se "Tipo de Papel" = "Cartão", então "Espessura" deve ser >= 250g
      if (config.name === 'Tipo de Papel' && selections[config.id]?.includes('CARTAO')) {
        const thicknessConfig = configurations.find(c => c.name === 'Espessura');
        if (thicknessConfig && selections[thicknessConfig.id]) {
          const thickness = Number(selections[thicknessConfig.id]);
          if (thickness < 250) {
            warnings.push('Para papel cartão, recomenda-se espessura de pelo menos 250g');
          }
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
   * Valida disponibilidade de materiais
   */
  async validateMaterialAvailability(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Buscar configurações que afetam componentes
    const configurations = await this.prisma.productConfiguration.findMany({
      where: { 
        productId,
        affectsComponents: true
      },
      include: {
        options: true
      }
    });

    for (const config of configurations) {
      const selectedValue = selections[config.id];
      if (!selectedValue) continue;

      const selectedOption = config.options.find((opt: any) => opt.value === selectedValue);
      if (!selectedOption) continue;

      // Verificar materiais adicionais
      if (selectedOption.additionalComponents) {
        const additionalComponents = JSON.parse(selectedOption.additionalComponents);
        
        for (const component of additionalComponents) {
          const material = await this.prisma.material.findUnique({
            where: { id: component.materialId },
            include: {
              inventoryItems: {
                where: { quantity: { gt: 0 } }
              }
            }
          });

          if (!material) {
            errors.push(`Material necessário para opção "${selectedOption.label}" não está cadastrado`);
          } else if (material.inventoryItems.length === 0) {
            warnings.push(`Material "${material.name}" para opção "${selectedOption.label}" está em falta no estoque`);
          }
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
   * Valida restrições de precificação
   */
  async validatePricingConstraints(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Buscar produto e suas configurações
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        configurations: {
          include: { options: true }
        }
      }
    });

    if (!product) {
      errors.push('Produto não encontrado');
      return { isValid: false, errors, warnings };
    }

    let totalPriceModifier = 0;

    // Calcular modificadores de preço
    for (const config of product.configurations) {
      if (!config.affectsPricing) continue;

      const selectedValue = selections[config.id];
      if (!selectedValue) continue;

      const selectedOption = config.options.find((opt: any) => opt.value === selectedValue);
      if (selectedOption && selectedOption.priceModifier) {
        totalPriceModifier += Number(selectedOption.priceModifier);
      }
    }

    // Verificar se o preço final não fica negativo
    const basePrice = Number(product.salePrice) || 0;
    const finalPrice = basePrice + totalPriceModifier;

    if (finalPrice < 0) {
      errors.push('As opções selecionadas resultam em um preço negativo');
    }

    // Verificar preço mínimo
    if (product.minPrice && finalPrice < Number(product.minPrice)) {
      warnings.push(`Preço final (R$ ${finalPrice.toFixed(2)}) está abaixo do preço mínimo (R$ ${Number(product.minPrice).toFixed(2)})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida capacidade de produção
   */
  async validateProductionCapability(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Buscar configurações que afetam produção
    const configurations = await this.prisma.productConfiguration.findMany({
      where: { productId },
      include: { options: true }
    });

    // Verificar limitações de produção baseadas nas seleções
    for (const config of configurations) {
      const selectedValue = selections[config.id];
      if (!selectedValue) continue;

      // Exemplo: verificar se máquinas suportam o tamanho selecionado
      if (config.name === 'Tamanho' && config.type === ConfigurationType.SELECT) {
        const selectedOption = config.options.find((opt: any) => opt.value === selectedValue);
        if (selectedOption) {
          // Verificar se existem máquinas que suportam este tamanho
          const machines = await this.prisma.machine.findMany({
            where: {
              status: 'AVAILABLE',
              active: true
            }
          });

          // Lógica específica para verificar compatibilidade com máquinas
          // Por exemplo, se o tamanho é maior que a capacidade das máquinas
          const hasCompatibleMachine = machines.some(machine => {
            // Implementar lógica de compatibilidade
            return true; // Placeholder
          });

          if (!hasCompatibleMachine) {
            warnings.push(`Tamanho "${selectedOption.label}" pode não ser compatível com as máquinas disponíveis`);
          }
        }
      }

      // Exemplo: verificar tempo de produção estimado
      if (config.name === 'Complexidade') {
        if (selectedValue === 'MUITO_COMPLEXO') {
          warnings.push('Produtos muito complexos podem ter prazo de entrega estendido');
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
   * Detecta conflitos entre configurações
   */
  async detectConfigurationConflicts(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ConflictResult> {
    const conflicts: ConfigurationConflict[] = [];

    // Executar todas as validações e coletar conflitos
    const validations = await Promise.all([
      this.validateDependencies(productId, selections),
      this.validateMaterialAvailability(productId, selections),
      this.validatePricingConstraints(productId, selections),
      this.validateProductionCapability(productId, selections)
    ]);

    // Converter erros em conflitos
    validations.forEach((validation, index) => {
      const types = ['DEPENDENCY', 'MATERIAL', 'PRICING', 'PRODUCTION'] as const;
      
      validation.errors.forEach(error => {
        conflicts.push({
          type: types[index],
          message: error,
          affectedConfigurations: Object.keys(selections),
          severity: 'ERROR'
        });
      });

      validation.warnings?.forEach(warning => {
        conflicts.push({
          type: types[index],
          message: warning,
          affectedConfigurations: Object.keys(selections),
          severity: 'WARNING'
        });
      });
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Sugere resoluções para conflitos
   */
  async suggestResolutions(conflicts: ConfigurationConflict[]): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'DEPENDENCY':
          if (conflict.message.includes('múltiplo de 4')) {
            suggestions.push({
              conflictId: conflict.type,
              suggestion: 'Ajuste o número de páginas para um múltiplo de 4',
              action: 'CHANGE_VALUE',
              parameters: { field: 'pages', rule: 'multiple_of_4' }
            });
          }
          break;

        case 'MATERIAL':
          if (conflict.message.includes('falta no estoque')) {
            suggestions.push({
              conflictId: conflict.type,
              suggestion: 'Adicione o material ao estoque ou escolha uma opção alternativa',
              action: 'ADD_MATERIAL',
              parameters: { action: 'restock_or_change_option' }
            });
          }
          break;

        case 'PRICING':
          if (conflict.message.includes('preço negativo')) {
            suggestions.push({
              conflictId: conflict.type,
              suggestion: 'Remova opções com desconto excessivo ou ajuste o preço base',
              action: 'ADJUST_PRICING',
              parameters: { action: 'increase_base_price' }
            });
          }
          break;

        case 'PRODUCTION':
          if (conflict.message.includes('não compatível')) {
            suggestions.push({
              conflictId: conflict.type,
              suggestion: 'Escolha um tamanho compatível com as máquinas disponíveis',
              action: 'CHANGE_VALUE',
              parameters: { field: 'size', constraint: 'machine_compatibility' }
            });
          }
          break;
      }
    }

    return suggestions;
  }

  /**
   * Valida todas as configurações de uma vez
   */
  async validateAllConfigurations(
    productId: string, 
    selections: ConfigurationSelections
  ): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Executar todas as validações
    const validations = await Promise.all([
      this.validateRequiredConfigurations(productId, selections),
      this.validateDependencies(productId, selections),
      this.validateMaterialAvailability(productId, selections),
      this.validatePricingConstraints(productId, selections),
      this.validateProductionCapability(productId, selections)
    ]);

    // Coletar todos os erros e avisos
    validations.forEach(validation => {
      allErrors.push(...validation.errors);
      if (validation.warnings) {
        allWarnings.push(...validation.warnings);
      }
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }
}
import { PricingMode } from '@prisma/client';
import { ProductComponentService } from '../../../modules/catalog/services/ProductComponentService';
import { prisma } from '../../infrastructure/database/prisma';

interface CalculationInput {
  product: {
    id: string;
    name: string;
    pricingMode: PricingMode;
    salePrice?: number;
    minPrice?: number;
    markup: number;
  };
  width: number;  // mm
  height: number; // mm
  quantity: number;
  configurations?: Record<string, any>;
  organizationSettings?: {
    enableEngineering: boolean;
    defaultMarkup: number;
  };
}

interface ConfigurationSelections {
  [configurationId: string]: any;
}

interface ComponentModifier {
  componentId: string;
  modificationType: 'MULTIPLY' | 'ADD' | 'REPLACE';
  value: number;
  unit?: string;
}

interface AdditionalComponent {
  materialId: string;
  consumptionMethod: string;
  quantity: number;
  wastePercentage: number;
  isOptional: boolean;
}

interface CalculationOutput {
  costPrice: number;       // Custo interno
  calculatedPrice: number; // Preço sugerido
  unitPrice: number;       // Preço final (inicialmente igual ao calculado)
  details: string[];       // Log do cálculo
  configurationSurcharge?: number; // Sobretaxa das configurações
  materials?: Array<{
    name: string;
    needed: number;
    unit: string;
    cost: number;
    wasteApplied: number;
    isFromConfiguration?: boolean;
  }>;
  configurationBreakdown?: Array<{
    configurationName: string;
    selectedOption: string;
    priceModifier: number;
    materialChanges: string[];
  }>;
}

export class PricingEngine {
  private productComponentService: ProductComponentService;

  constructor() {
    this.productComponentService = new ProductComponentService(prisma);
  }
  
  async execute(input: CalculationInput): Promise<CalculationOutput> {
    const { product, width, height, quantity, configurations = {}, organizationSettings } = input;
    
    // Se o modo é DYNAMIC_ENGINEER mas a engenharia está desabilitada, forçar modo simples
    let effectivePricingMode = product.pricingMode;
    if (product.pricingMode === 'DYNAMIC_ENGINEER' && 
        organizationSettings && 
        !organizationSettings.enableEngineering) {
      
      // Fallback para modo simples por área
      effectivePricingMode = 'SIMPLE_AREA';
      
      // Usar markup padrão da organização se não houver salePrice
      if (!product.salePrice && organizationSettings.defaultMarkup) {
        // Estimativa básica: R$ 50/m² como base
        const estimatedCostPerM2 = 50;
        const suggestedPrice = estimatedCostPerM2 * organizationSettings.defaultMarkup;
        
        const areaM2 = (width * height) / 1_000_000;
        const totalPerUnit = areaM2 * suggestedPrice;
        const minPrice = product.minPrice || 0;
        const finalPrice = Math.max(totalPerUnit, minPrice);
        
        return {
          costPrice: areaM2 * estimatedCostPerM2,
          calculatedPrice: finalPrice,
          unitPrice: finalPrice,
          details: [
            `⚠️ MODO ENGENHARIA DESABILITADO - Usando cálculo simplificado`,
            `Área: ${areaM2.toFixed(3)}m²`,
            `Custo estimado: R$ ${estimatedCostPerM2.toFixed(2)}/m²`,
            `Markup aplicado: ${organizationSettings.defaultMarkup}x`,
            `Preço sugerido: R$ ${suggestedPrice.toFixed(2)}/m²`,
            `Preço mínimo: R$ ${minPrice.toFixed(2)}`,
            `Preço final: R$ ${finalPrice.toFixed(2)}`
          ]
        };
      }
    }
    
    // MODO 1: Preço Simples por Área (m²)
    if (effectivePricingMode === 'SIMPLE_AREA') {
      const areaM2 = (width * height) / 1_000_000;
      const basePrice = product.salePrice || 0;
      const totalPerUnit = areaM2 * basePrice;
      const minPrice = product.minPrice || 0;
      const finalPrice = Math.max(totalPerUnit, minPrice);
      
      return {
        costPrice: 0, // No modo simples, custo é estimado
        calculatedPrice: finalPrice,
        unitPrice: finalPrice,
        details: [
          `Área: ${areaM2.toFixed(3)}m²`,
          `Preço base: R$ ${basePrice.toFixed(2)}/m²`,
          `Subtotal: R$ ${totalPerUnit.toFixed(2)}`,
          `Preço mínimo: R$ ${minPrice.toFixed(2)}`,
          `Preço final: R$ ${finalPrice.toFixed(2)}`
        ]
      };
    }

    // MODO 2: Preço Simples por Unidade
    if (effectivePricingMode === 'SIMPLE_UNIT') {
      const basePrice = product.salePrice || 0;
      const minPrice = product.minPrice || 0;
      const finalPrice = Math.max(basePrice, minPrice);
      
      return {
        costPrice: 0,
        calculatedPrice: finalPrice,
        unitPrice: finalPrice,
        details: [
          `Preço unitário: R$ ${basePrice.toFixed(2)}`,
          `Preço mínimo: R$ ${minPrice.toFixed(2)}`,
          `Preço final: R$ ${finalPrice.toFixed(2)}`
        ]
      };
    }

    // MODO 3: Engenharia (Custo + Margem) - USANDO COMPONENTES REAIS
    if (effectivePricingMode === 'DYNAMIC_ENGINEER') {
      // Verificar se a engenharia está habilitada
      if (organizationSettings && !organizationSettings.enableEngineering) {
        throw new Error("Modo de Engenharia Dinâmica não está habilitado para esta organização");
      }

      // Buscar componentes reais do produto
      const components = await this.productComponentService.listComponents(product.id);
      
      if (components.length === 0) {
        throw new Error("Produto não possui materiais configurados. Configure materiais primeiro.");
      }

      let totalCost = 0;
      const logs: string[] = [];
      const materials: Array<{
        name: string;
        needed: number;
        unit: string;
        cost: number;
        wasteApplied: number;
      }> = [];

      // A. Custo de Materiais usando componentes reais
      for (const component of components) {
        // Pular materiais opcionais se não há materiais obrigatórios suficientes
        if (component.isOptional && totalCost === 0) {
          continue;
        }

        const materialCalculation = this.calculateRealMaterialCost(
          component, 
          width, 
          height, 
          quantity,
          configurations
        );
        
        if (materialCalculation.cost > 0) {
          totalCost += materialCalculation.cost;
          logs.push(`${component.material.name}: ${materialCalculation.needed.toFixed(2)} ${materialCalculation.unit} = R$ ${materialCalculation.cost.toFixed(2)}`);
          
          materials.push({
            name: component.material.name,
            needed: materialCalculation.needed,
            unit: materialCalculation.unit,
            cost: materialCalculation.cost,
            wasteApplied: materialCalculation.wasteApplied
          });
        }
      }

      // B. Aplicar configurações que afetam preço
      let configurationModifier = 0;
      const configLogs: string[] = [];
      const configurationBreakdown: Array<{
        configurationName: string;
        selectedOption: string;
        priceModifier: number;
        materialChanges: string[];
      }> = [];
      
      // Buscar configurações do produto se existirem seleções
      if (Object.keys(configurations).length > 0) {
        try {
          const productConfigurations = await prisma.productConfiguration.findMany({
            where: { productId: product.id },
            include: {
              options: true
            }
          });

          for (const config of productConfigurations) {
            const selectedValue = configurations[config.id];
            if (!selectedValue) continue;

            // Para configurações SELECT, buscar a opção selecionada
            if (config.type === 'SELECT') {
              const selectedOption = config.options.find(opt => opt.value === selectedValue);
              if (selectedOption && selectedOption.priceModifier) {
                const modifier = Number(selectedOption.priceModifier);
                configurationModifier += modifier;
                
                configurationBreakdown.push({
                  configurationName: config.name,
                  selectedOption: selectedOption.label,
                  priceModifier: modifier,
                  materialChanges: []
                });

                configLogs.push(`${config.name}: ${selectedOption.label} = ${modifier > 0 ? '+' : ''}R$ ${modifier.toFixed(2)}`);
              }
            }
            // Para configurações NUMBER/BOOLEAN, aplicar lógica específica se necessário
            else if (config.affectsPricing) {
              // Implementar lógica específica para outros tipos se necessário
              configLogs.push(`${config.name}: ${selectedValue} (configuração aplicada)`);
            }
          }
        } catch (error) {
          console.error('Erro ao processar configurações:', error);
          configLogs.push('⚠️ Erro ao processar algumas configurações');
        }
      }

      const suggestedPrice = (totalCost + configurationModifier) * product.markup;
      const minPrice = product.minPrice || 0;
      const finalPrice = Math.max(suggestedPrice, minPrice);

      return {
        costPrice: totalCost,
        calculatedPrice: suggestedPrice,
        unitPrice: finalPrice,
        configurationSurcharge: configurationModifier,
        materials,
        configurationBreakdown,
        details: [
          `Quantidade: ${quantity} unidades`,
          `Custo de materiais: R$ ${totalCost.toFixed(2)}`,
          `Modificador configurações: R$ ${configurationModifier.toFixed(2)}`,
          `Markup: ${product.markup}x`,
          `Preço sugerido: R$ ${suggestedPrice.toFixed(2)}`,
          `Preço mínimo: R$ ${minPrice.toFixed(2)}`,
          `Preço final: R$ ${finalPrice.toFixed(2)}`,
          ...logs,
          ...configLogs
        ]
      };
    }

    throw new Error("Modo de precificação inválido");
  }

  private calculateRealMaterialCost(
    component: any, 
    width: number, 
    height: number, 
    quantity: number,
    configurations: Record<string, any>
  ): { cost: number; needed: number; unit: string; wasteApplied: number } {
    
    const wastePercentage = component.manualWastePercentage || component.wastePercentage;
    let consumption = 0;
    let unit = component.material.unit;
    
    switch (component.consumptionMethod) {
      case 'BOUNDING_BOX':
        // Para chapas: calcular quantas chapas são necessárias
        if (component.material.format === 'SHEET') {
          const itemArea = (width * height) / 1_000_000; // m²
          const sheetArea = ((component.material.standardWidth || 0) * (component.material.standardLength || 0)) / 1_000_000;
          
          if (sheetArea > 0 && width <= (component.material.standardWidth || 0) && height <= (component.material.standardLength || 0)) {
            const sheetsPerItem = Math.ceil(itemArea / sheetArea);
            consumption = sheetsPerItem * quantity;
            unit = 'folhas';
          }
        } else {
          // Para outros formatos, usar área
          consumption = ((width * height) / 1_000_000) * quantity; // m²
          unit = 'm²';
        }
        break;
        
      case 'LINEAR_NEST':
        // Para rolos: comprimento linear
        if (component.material.format === 'ROLL') {
          const materialWidth = component.material.standardWidth || 1000;
          if (width <= materialWidth) {
            consumption = (height * quantity) / 1000; // metros
            unit = 'metros';
          }
        }
        break;
        
      case 'FIXED_AMOUNT':
        // Quantidade fixa por item
        consumption = quantity;
        unit = component.material.unit;
        break;
        
      default:
        // Default: área
        consumption = ((width * height) / 1_000_000) * quantity;
        unit = 'm²';
    }
    
    // Aplica percentual de perda
    const consumptionWithWaste = consumption * (1 + wastePercentage);
    const cost = consumptionWithWaste * component.material.costPerUnit;
    
    return {
      cost,
      needed: consumptionWithWaste,
      unit,
      wasteApplied: wastePercentage * 100
    };
  }
}
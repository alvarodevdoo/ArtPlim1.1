import { PricingMode } from '@prisma/client';

interface CalculationInput {
  product: {
    id: string;
    name: string;
    pricingMode: PricingMode;
    salePrice?: number;
    minPrice?: number;
    markup: number;
    components?: Array<{
      material: {
        name: string;
        costPerUnit: number;
        format: string;
      };
      consumptionMethod: string;
      wastePercentage: number;
    }>;
    operations?: Array<{
      name: string;
      costPerMinute: number;
      setupTime: number;
    }>;
  };
  width: number;  // mm
  height: number; // mm
  quantity: number;
  organizationSettings?: {
    enableEngineering: boolean;
    defaultMarkup: number;
  };
}

interface CalculationOutput {
  costPrice: number;       // Custo interno
  calculatedPrice: number; // Preço sugerido
  unitPrice: number;       // Preço final (inicialmente igual ao calculado)
  details: string[];       // Log do cálculo
}

export class PricingEngine {
  
  execute(input: CalculationInput): CalculationOutput {
    const { product, width, height, quantity, organizationSettings } = input;
    
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

    // MODO 3: Engenharia (Custo + Margem)
    if (effectivePricingMode === 'DYNAMIC_ENGINEER') {
      // Verificar se a engenharia está habilitada
      if (organizationSettings && !organizationSettings.enableEngineering) {
        throw new Error("Modo de Engenharia Dinâmica não está habilitado para esta organização");
      }
      let totalCost = 0;
      const logs: string[] = [];

      // A. Custo de Materiais
      if (product.components) {
        for (const component of product.components) {
          const materialCost = this.calculateMaterialCost(component, width, height);
          totalCost += materialCost;
          logs.push(`${component.material.name}: R$ ${materialCost.toFixed(2)}`);
        }
      }

      // B. Custo de Operações (Tempo de máquina)
      if (product.operations) {
        for (const operation of product.operations) {
          const opCost = this.calculateOperationCost(operation, width, height);
          totalCost += opCost;
          logs.push(`${operation.name}: R$ ${opCost.toFixed(2)}`);
        }
      }

      const suggestedPrice = totalCost * product.markup;
      const minPrice = product.minPrice || 0;
      const finalPrice = Math.max(suggestedPrice, minPrice);

      return {
        costPrice: totalCost,
        calculatedPrice: suggestedPrice,
        unitPrice: finalPrice,
        details: [
          `Custo total: R$ ${totalCost.toFixed(2)}`,
          `Markup: ${product.markup}x`,
          `Preço sugerido: R$ ${suggestedPrice.toFixed(2)}`,
          `Preço mínimo: R$ ${minPrice.toFixed(2)}`,
          `Preço final: R$ ${finalPrice.toFixed(2)}`,
          ...logs
        ]
      };
    }

    throw new Error("Modo de precificação inválido");
  }

  private calculateMaterialCost(component: any, width: number, height: number): number {
    const { material, consumptionMethod, wastePercentage } = component;
    
    let consumption = 0;
    
    switch (consumptionMethod) {
      case 'BOUNDING_BOX':
        // Para chapas: área do retângulo
        consumption = (width * height) / 1_000_000; // m²
        break;
        
      case 'LINEAR_NEST':
        // Para rolos: comprimento linear
        consumption = width / 1000; // metros lineares
        break;
        
      case 'FIXED_AMOUNT':
        // Quantidade fixa por peça
        consumption = 1;
        break;
        
      default:
        consumption = (width * height) / 1_000_000; // Default: área
    }
    
    // Aplica percentual de perda
    const consumptionWithWaste = consumption * (1 + wastePercentage);
    
    return consumptionWithWaste * material.costPerUnit;
  }
  
  private calculateOperationCost(operation: any, width: number, height: number): number {
    const { costPerMinute, setupTime } = operation;
    
    // Cálculo simplificado: tempo baseado no perímetro (para corte laser)
    const perimeter = 2 * (width + height); // mm
    const perimeterM = perimeter / 1000; // metros
    
    // Estimativa: 1 metro de corte = 1 minuto (ajustar conforme a máquina)
    const cuttingTime = perimeterM;
    const totalTime = setupTime + cuttingTime;
    
    return totalTime * costPerMinute;
  }
}
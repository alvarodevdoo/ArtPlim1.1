import { z } from 'zod';
import { ConsumptionRule } from '@prisma/client';

export const CalculateMaterialConsumptionSchema = z.object({
  rule: z.enum(['FIXED_UNIT', 'PRODUCT_AREA', 'PERIMETER', 'SPACING']),
  params: z.object({
    requestedQuantity: z.number().default(1),
    productWidth: z.number().optional(), // em metros
    productHeight: z.number().optional(), // em metros
    consumptionFactor: z.number().default(1), // conversor de unidade
  }),
});

export type CalculateMaterialConsumptionInput = z.infer<typeof CalculateMaterialConsumptionSchema>;

/**
 * CalculateMaterialConsumptionUseCase
 * 
 * Especialista sênior em cálculos de consumo fracionado para ERP.
 * Esta lógica garante que independentemente da unidade de compra,
 * o débito no estoque ocorra na Unidade de Controle configurada.
 */
export class CalculateMaterialConsumptionUseCase {
  async execute(input: CalculateMaterialConsumptionInput): Promise<number> {
    const { rule, params } = CalculateMaterialConsumptionSchema.parse(input);
    const { requestedQuantity, productWidth = 0, productHeight = 0, consumptionFactor } = params;

    switch (rule) {
      case 'FIXED_UNIT':
        // Desconto fixo por unidade solicitada (ex: 1 foto = 1 unidade de estoque)
        // O fator de conversão é usado no momento da ENTRADA no estoque, 
        // aqui o consumo é direto sobre a unidade de controle.
        return requestedQuantity;

      case 'PRODUCT_AREA':
        // Cálculo de Área: Base (m) * Altura (m) * Quantidade
        if (productWidth <= 0 || productHeight <= 0) {
          throw new Error('Largura e Altura são obrigatórias para regra PRODUCT_AREA');
        }
        const area = productWidth * productHeight;
        return area * requestedQuantity;

      case 'PERIMETER':
        // Cálculo de Perímetro: (Largura + Altura) * 2 * Quantidade
        if (productWidth <= 0 || productHeight <= 0) {
          throw new Error('Largura e Altura são obrigatórias para regra PERIMETER');
        }
        const perimeter = (productWidth + productHeight) * 2;
        return perimeter * requestedQuantity;

      case 'SPACING':
        // Exemplo: Ilhóes a cada 50cm no perímetro
        // Esta regra pode evoluir para algo mais complexo. 
        // Implementação básica: se o fator for 0.5 (50cm), calcula quantos cabem.
        if (productWidth <= 0 || productHeight <= 0) {
           return requestedQuantity;
        }
        const totalPerimeter = (productWidth + productHeight) * 2;
        const spacing = consumptionFactor > 0 ? consumptionFactor : 0.5; // default 50cm
        const unitsPerItem = Math.ceil(totalPerimeter / spacing);
        return unitsPerItem * requestedQuantity;

      default:
        return requestedQuantity;
    }
  }
}

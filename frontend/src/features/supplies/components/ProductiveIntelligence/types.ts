export type ControlUnit = 'UN' | 'M' | 'M2' | 'ML';
export type ConsumptionRule = 'FIXED_UNIT' | 'PRODUCT_AREA' | 'PERIMETER' | 'SPACING';
export type DimUnit = 'm' | 'cm' | 'mm';

export interface ProductiveIntelligenceData {
  // Aba Logística de Compra
  purchaseUnit: string; // unidade_de_compra (Ex: UN, PAC, CX)
  multiplicador_padrao_entrada: number; // Fator de Embalagem Sugerido (Inteiro)
  largura_unitaria: number; // Largura em METROS
  altura_unitaria: number; // Altura em METROS
  
  // Aba Consumo / Venda
  controlUnit: ControlUnit; // unidade_controle (Ex: M2)
  defaultConsumptionRule: ConsumptionRule; // regra_consumo (Ex: PRODUCT_AREA)
  
  // Fator de Conversão (Calculado: Largura * Altura)
  conversionFactor: number;
}

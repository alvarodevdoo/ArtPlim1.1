// ─── General Product Draft ────────────────────────────────────────────────────
export interface ProductDraft {
  id?: string;
  name: string;
  description?: string;
  productType: 'PRODUCT' | 'SERVICE' | 'PRINT_SHEET' | 'PRINT_ROLL' | 'LASER_CUT' | 'UNIT' | 'SQUARE_METER' | 'TIME_AREA';
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice: number;          // Preço de venda manual (priceOverride global)
  costPrice: number;
  active: boolean;
  priceLocked?: boolean;
  categoryId?: string;
  revenueAccountId?: string;
  trackStock: boolean;
  stockQuantity: number;
  stockMinQuantity: number;
  stockUnit: string;
  sellWithoutStock: boolean;
  formulaData?: any;
  pricingRuleId?: string;
  isCommissionable?: boolean;
  specificCommissionRate?: number;
  maxDiscountThreshold?: number;
}

// ─── BOM (Ficha Técnica) Draft ─────────────────────────────────────────────────
export interface DraftBOMItem {
  id: string;
  materialId?: string | null;
  materialName: string;
  unit: string;
  quantity: number;
  width?: number;
  height?: number;
  itemsPerUnit: number;
  costPerUnit: number;
  effectiveCost: number;
  subtotal: number;
  salePrice?: number;
  isFixed: boolean;
  configurationOptionId?: string | null;
  configurationGroupId?: string | null;
}

// ─── Variations Draft ──────────────────────────────────────────────────────────
export interface DraftOption {
  /** UUID from DB if persisted, otherwise a temp ID */
  id: string;
  label: string;
  value: string;
  /** Manual price override for this option (replaces global salePrice when selected) */
  priceOverride?: number | null;
  /** Fixed sale value for this variation (e.g. "Valor Fixo" in UI) */
  fixedValue?: number | null;
  /** Additional cost modifier (FIXED add-on to base cost) */
  priceModifier: number;
  /**
   * Como o priceModifier é aplicado:
   * - FIXED (padrão): soma fixa no total do item (ex: Ilhós R$0,50/un × 10 = R$5)
   * - PER_AREA: soma ao R$/m² (multiplicado pela área no cálculo final;
   *   ex: Corte e contorno +R$5/m² sobre adesivo de R$25/m² → R$30/m²)
   * - PERCENTAGE: legado, não implementado no cálculo atual
   */
  priceModifierType: 'FIXED' | 'PERCENTAGE' | 'PER_AREA';
  materialId?: string | null;
  materialName?: string | null;
  isAvailable: boolean;
  displayOrder: number;
  /** Quantidade padrão consumida (usado em ACABAMENTOS — ex: 8 ilhos, 2 cabos) */
  defaultQuantity?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  /** Permite ao vendedor ajustar a quantidade no pedido */
  allowCustomQty?: boolean;
  /** Cascata: IDs de opções de grupos posteriores habilitadas por esta opção */
  allowedChildIds?: string[] | null;
  /**
   * Motor DYNAMIC_ENGINEER — operação que esta opção executa quando selecionada:
   * - REPLACE_VAR: substitui o valor da variável da fórmula apontada por `formulaVariableTarget`
   * - ADD_VAR:     soma `priceModifier` na variável apontada por `formulaVariableTarget`
   * - ADD_FINAL:   soma `priceModifier` no preço final do item (sem tocar em variável)
   * Null/undefined = comportamento legado (motores SIMPLE_AREA/SIMPLE_UNIT via priceModifierType).
   */
  formulaOp?: 'REPLACE_VAR' | 'ADD_VAR' | 'ADD_FINAL' | null;
  /** ID/nome da variável da fórmula alvo (obrigatório para REPLACE_VAR/ADD_VAR). */
  formulaVariableTarget?: string | null;
}

export type ConfigurationKind = 'VARIATION' | 'FINISHING';

export interface DraftVariationGroup {
  /** UUID from DB if persisted, otherwise a temp ID */
  id: string;
  name: string;
  type: 'SELECT' | 'NUMBER' | 'BOOLEAN' | 'TEXT';
  /**
   * Papel do grupo no cálculo:
   * - VARIATION: identidade (cor/tamanho/papel) — exclusivo, expande SKUs.
   * - FINISHING: acabamento — aditivo (multi-select), soma materiais ao item.
   */
  kind: ConfigurationKind;
  required: boolean;
  displayOrder: number;
  options: DraftOption[];
}

// ─── Financial Summary (computed, never stored) ───────────────────────────────
export interface FinancialSummary {
  fixedCost: number;
  variationCost: number;
  totalCost: number;
  salePrice: number;
  grossProfit: number;
  marginPercent: number;
  isSalePriceOverridden?: boolean;
  baseSalePrice: number;
}

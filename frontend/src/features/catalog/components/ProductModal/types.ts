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
  priceModifierType: 'FIXED' | 'PERCENTAGE';
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

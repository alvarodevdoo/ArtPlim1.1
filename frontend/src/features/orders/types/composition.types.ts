/**
 * Tipos centrais do Motor de Composição.
 * Espelhamento das interfaces do backend para uso no frontend.
 * Package by Feature: toda tipagem do configurador vive aqui.
 */

// ── Composição ──────────────────────────────────────────────────────────────

export interface CompositionLineItem {
  materialId: string;
  materialName: string;
  quantity: number;
  costPerUnit: number;
  subtotal: number;
  source: 'FICHA_TECNICA' | 'OPTION_SLOT' | 'ADDITIONAL_COMPONENT';
  optionLabel?: string;
}

export interface InsufficientStockItem {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  currentStock: number;
  deficit: number;
}

export interface CompositionResult {
  baseMaterialCost: number;
  variableMaterialCost: number;
  totalCost: number;
  suggestedPrice: number;
  suggestedMarkup: number;
  currentMargin: number;      // 0.0–1.0
  breakdown: CompositionLineItem[];
  insufficientStock: InsufficientStockItem[];
}

// ── Produto com configurações ────────────────────────────────────────────────

export interface ConfigOption {
  id: string;
  label: string;
  value: string;
  priceModifier: number;
  displayOrder: number;
  isAvailable: boolean;
  materialId?: string;
  slotQuantity?: number;
  priceOverride?: number;
}

export interface ProductConfig {
  id: string;
  name: string;
  type: 'SELECT' | 'NUMBER' | 'BOOLEAN';
  required: boolean;
  displayOrder: number;
  options: ConfigOption[];
}

// ── Incompatibilidades ───────────────────────────────────────────────────────

export interface IncompatibilityResult {
  blockedIds: string[];
  reasons: Record<string, string>; // optionId → motivo
}

// ── Estado interno do configurador ───────────────────────────────────────────

export interface ConfiguratorState {
  /** Mapa configId → optionId selecionado */
  selectedOptions: Record<string, string>;
  /** Preço de venda final (pode ser ajustado manualmente) */
  negotiatedPrice: number;
  /** Resultado do cálculo de composição */
  composition: CompositionResult | null;
  /** IDs de opções bloqueadas por incompatibilidade */
  blockedOptionIds: string[];
  /** Motivos de bloqueio por optionId */
  incompatibilityReasons: Record<string, string>;
  /** Quantidade do item */
  quantity: number;
}

// ── Alerta de margem ─────────────────────────────────────────────────────────

export type MarginStatus = 'HEALTHY' | 'WARNING' | 'DANGER' | 'NEGATIVE';

export function getMarginStatus(
  negotiatedPrice: number,
  totalCost: number,
  targetMarkup?: number
): MarginStatus {
  if (totalCost <= 0) return 'HEALTHY';
  const profit = negotiatedPrice - totalCost;
  if (profit < 0) return 'NEGATIVE';

  const actualMarkup = negotiatedPrice / totalCost;
  const target = targetMarkup || 2.0;

  if (actualMarkup >= target) return 'HEALTHY';
  if (actualMarkup >= target * 0.8) return 'WARNING';
  return 'DANGER';
}

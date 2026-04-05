import { BudgetStatus, OrderStatus, PricingMode, ItemType } from '@prisma/client';

export interface ProductDraft {
  id?: string;
  name: string;
  description?: string;
  productType: ItemType;
  pricingMode: PricingMode;
  salePrice: number;
  costPrice: number;
  markup: number;
  targetMarkup?: number;
  targetMargin?: number;
  active: boolean;
  categoryId?: string;
  revenueAccountId?: string;
  trackStock: boolean;
  stockQuantity: number;
  stockMinQuantity: number;
  stockUnit: string;
  sellWithoutStock: boolean;
  formulaData?: any;
  pricingRuleId?: string;
  
  // Real-time Composition (Simulated)
  compositionSnapshot?: any;
}

export interface BOMItem {
  id?: string;
  materialId: string;
  materialName: string;
  quantity: number;
  costPerUnit: number;
  subtotal: number;
  isFixed: boolean;
  variationGroupId?: string; // If null, it's fixed. If set, it's a slot for a group.
}

export interface ConfigurationOption {
  id: string;
  label: string;
  value: string;
  materialId?: string;
  priceModifier: number;
  priceModifierType: 'FIXED' | 'PERCENTAGE';
  isAvailable: boolean;
  displayOrder: number;
  incompatibilities: string[]; // List of other option IDs that are incompatible
}

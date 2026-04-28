export interface CreateOrderItemDTO {
  productId: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  discountStatus?: string;
  notes?: string;
  
  // Campos específicos por tipo
  area?: number;
  paperSize?: string;
  paperType?: string;
  printColors?: string;
  finishing?: string;
  machineTime?: number;
  setupTime?: number;
  complexity?: string;
  
  // Tamanho personalizado
  customSizeName?: string;
  isCustomSize?: boolean;
  attributes?: Record<string, any>;
  pricingRuleId?: string;
}

export interface CreateOrderDTO {
  customerId: string;
  items: CreateOrderItemDTO[];
  globalDiscount?: number;
  discountStatus?: string;
  deliveryDate?: string | null;
  notes?: string | null;
}
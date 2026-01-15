export interface CreateOrderItemDTO {
  productId: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice?: number;
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
}

export interface CreateOrderDTO {
  customerId: string;
  items: CreateOrderItemDTO[];
  deliveryDate?: string | null;
  notes?: string | null;
}
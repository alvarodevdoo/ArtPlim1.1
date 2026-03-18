import { ItemType } from './item-types';

export interface StandardSize {
    id: string;
    name: string;
    width: number;
    height: number;
    isDefault: boolean;
}

export interface Produto {
    id: string;
    name: string;
    description?: string;
    productType?: ItemType;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    standardSizes?: StandardSize[];
}

export interface Cliente {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    document?: string;
}

export interface ItemPedido {
    id: string;
    productId: string;
    product?: Produto;
    itemType: ItemType;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    attributes?: Record<string, any>;

    // Legacy fields/Specific fields
    area?: number;
    paperSize?: string;
    paperType?: string;
    printColors?: string;
    finishing?: string;
    machineTime?: number;
    setupTime?: number;
    complexity?: string;

    // Custom Size
    customSizeName?: string;
    isCustomSize?: boolean;

    // Status
    processStatusId?: string;
    processStatus?: {
        id: string;
        name: string;
        color: string;
        mappedBehavior: string;
    };
    status?: string;
}

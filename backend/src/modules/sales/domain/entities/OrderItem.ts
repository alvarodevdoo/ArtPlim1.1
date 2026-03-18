import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';

export interface OrderItemProps {
  id?: string;
  productId: string;
  dimensions: Dimensions;
  quantity: number;
  costPrice: Money;
  calculatedPrice: Money;
  unitPrice: Money;
  notes?: string;
  
  // Campos específicos por tipo de produto
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
}

export class OrderItem {
  private _id?: string;
  private _productId: string;
  private _dimensions: Dimensions;
  private _quantity: number;
  private _costPrice: Money;
  private _calculatedPrice: Money;
  private _unitPrice: Money;
  private _notes?: string;
  
  // Campos específicos
  private _area?: number;
  private _paperSize?: string;
  private _paperType?: string;
  private _printColors?: string;
  private _finishing?: string;
  private _machineTime?: number;
  private _setupTime?: number;
  private _complexity?: string;
  private _customSizeName?: string;
  private _isCustomSize?: boolean;
  private _attributes?: Record<string, any>;

  constructor(props: OrderItemProps) {
    this._id = props.id;
    this._productId = props.productId;
    this._dimensions = props.dimensions;
    this._quantity = props.quantity;
    this._costPrice = props.costPrice;
    this._calculatedPrice = props.calculatedPrice;
    this._unitPrice = props.unitPrice;
    this._notes = props.notes;
    
    // Campos específicos
    this._area = props.area;
    this._paperSize = props.paperSize;
    this._paperType = props.paperType;
    this._printColors = props.printColors;
    this._finishing = props.finishing;
    this._machineTime = props.machineTime;
    this._setupTime = props.setupTime;
    this._complexity = props.complexity;
    this._customSizeName = props.customSizeName;
    this._isCustomSize = props.isCustomSize;
    this._attributes = props.attributes;

    this.validate();
  }

  private validate(): void {
    if (this._quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }
    
    if (!this._productId || this._productId.trim().length === 0) {
      throw new Error('Product ID is required');
    }
  }

  // Getters
  get id(): string | undefined {
    return this._id;
  }

  get productId(): string {
    return this._productId;
  }

  get dimensions(): Dimensions {
    return this._dimensions;
  }

  get quantity(): number {
    return this._quantity;
  }

  get costPrice(): Money {
    return this._costPrice;
  }

  get calculatedPrice(): Money {
    return this._calculatedPrice;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get totalPrice(): Money {
    return this._unitPrice.multiply(this._quantity);
  }

  get notes(): string | undefined {
    return this._notes;
  }

  // Campos específicos - getters
  get area(): number | undefined {
    return this._area;
  }

  get paperSize(): string | undefined {
    return this._paperSize;
  }

  get paperType(): string | undefined {
    return this._paperType;
  }

  get printColors(): string | undefined {
    return this._printColors;
  }

  get finishing(): string | undefined {
    return this._finishing;
  }

  get machineTime(): number | undefined {
    return this._machineTime;
  }

  get setupTime(): number | undefined {
    return this._setupTime;
  }

  get complexity(): string | undefined {
    return this._complexity;
  }

  get customSizeName(): string | undefined {
    return this._customSizeName;
  }

  get isCustomSize(): boolean | undefined {
    return this._isCustomSize;
  }

  get attributes(): Record<string, any> | undefined {
    return this._attributes;
  }

  // Métodos de negócio
  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }
    this._quantity = newQuantity;
  }

  updateUnitPrice(newPrice: Money): void {
    this._unitPrice = newPrice;
  }

  updateNotes(notes: string): void {
    this._notes = notes;
  }

  equals(other: OrderItem): boolean {
    return this._id === other._id;
  }

  toJSON(): any {
    return {
      id: this._id,
      productId: this._productId,
      width: this._dimensions.width,
      height: this._dimensions.height,
      quantity: this._quantity,
      costPrice: this._costPrice.value,
      calculatedPrice: this._calculatedPrice.value,
      unitPrice: this._unitPrice.value,
      totalPrice: this.totalPrice.value,
      notes: this._notes,
      
      // Campos específicos
      area: this._area,
      paperSize: this._paperSize,
      paperType: this._paperType,
      printColors: this._printColors,
      finishing: this._finishing,
      machineTime: this._machineTime,
      setupTime: this._setupTime,
      complexity: this._complexity,
      customSizeName: this._customSizeName,
      isCustomSize: this._isCustomSize,
      attributes: this._attributes
    };
  }
}
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';
import { OrderStatusEnum } from '../value-objects/OrderStatus';

export enum DiscountStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

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
  pricingRuleId?: string;
  processStatusId?: string;
  status?: OrderStatusEnum;
  
  // Motor de Composição: campos de snapshot (imutáveis após APPROVED)
  unitCostAtSale?: number;
  unitPriceAtSale?: number;
  profitAtSale?: number;
  compositionSnapshot?: any;
  confirmedAt?: Date;

  discountStatus?: DiscountStatus;
  discountItem?: Money;
  discountGlobal?: Money;
  commissionRateApplied?: number;
  commissionAmount?: Money;
  authorizationRequestId?: string;
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
  private _pricingRuleId?: string;
  private _processStatusId?: string;
  private _status: OrderStatusEnum;
  
  // Novos campos do motor de composição
  private _unitCostAtSale?: number;
  private _unitPriceAtSale?: number;
  private _profitAtSale?: number;
  private _compositionSnapshot?: any;
  private _confirmedAt?: Date;

  private _discountStatus: DiscountStatus;
  private _discountItem: Money;
  private _discountGlobal: Money;
  private _commissionRateApplied: number;
  private _commissionAmount: Money;
  private _authorizationRequestId?: string;
  private _globalDiscountStatus: DiscountStatus;

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
    this._pricingRuleId = props.pricingRuleId;
    this._processStatusId = props.processStatusId;
    this._status = props.status || OrderStatusEnum.DRAFT;
    
    // Motor de composição
    this._unitCostAtSale = props.unitCostAtSale;
    this._unitPriceAtSale = props.unitPriceAtSale;
    this._profitAtSale = props.profitAtSale;
    this._compositionSnapshot = props.compositionSnapshot;
    this._confirmedAt = props.confirmedAt;

    this._discountStatus = props.discountStatus || DiscountStatus.NONE;
    this._discountItem = props.discountItem || Money.zero();
    this._discountGlobal = props.discountGlobal || Money.zero();
    this._commissionRateApplied = props.commissionRateApplied || 0;
    this._commissionAmount = props.commissionAmount || Money.zero();
    this._authorizationRequestId = props.authorizationRequestId;
    this._globalDiscountStatus = DiscountStatus.NONE;

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
    const gross = this._unitPrice.multiply(this._quantity);
    
    // Se o desconto do item estiver pendente ou rejeitado, o total do item é o valor bruto (gross)
    if (this._discountStatus === DiscountStatus.PENDING || this._discountStatus === DiscountStatus.REJECTED) {
      return gross;
    }

    let discount = this._discountItem;
    
    // Se o desconto global estiver pendente ou rejeitado em relação ao pedido, não subtrai da visão do item
    if (this._globalDiscountStatus !== DiscountStatus.PENDING && this._globalDiscountStatus !== DiscountStatus.REJECTED) {
      discount = discount.add(this._discountGlobal);
    }

    return gross.subtract(discount);
  }

  get discountStatus(): DiscountStatus {
    return this._discountStatus;
  }

  get discountItem(): Money {
    return this._discountItem;
  }

  get discountGlobal(): Money {
    return this._discountGlobal;
  }

  get commissionRateApplied(): number {
    return this._commissionRateApplied;
  }

  get commissionAmount(): Money {
    return this._commissionAmount;
  }

  get authorizationRequestId(): string | undefined {
    return this._authorizationRequestId;
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
  
  get pricingRuleId(): string | undefined {
    return this._pricingRuleId;
  }

  get processStatusId(): string | undefined {
    return this._processStatusId;
  }

  set processStatusId(id: string | undefined) {
    this._processStatusId = id;
  }

  get status(): OrderStatusEnum {
    return this._status;
  }

  // Getters para motor de composição
  get unitCostAtSale(): number | undefined {
    return this._unitCostAtSale;
  }

  get unitPriceAtSale(): number | undefined {
    return this._unitPriceAtSale;
  }

  get profitAtSale(): number | undefined {
    return this._profitAtSale;
  }

  get compositionSnapshot(): any {
    return this._compositionSnapshot;
  }

  get confirmedAt(): Date | undefined {
    return this._confirmedAt;
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

  applyDiscount(discountItem: Money, discountGlobal: Money): void {
    this._discountItem = discountItem;
    this._discountGlobal = discountGlobal;
  }

  applyCommission(rate: number, amount: Money): void {
    this._commissionRateApplied = rate;
    this._commissionAmount = amount;
  }

  updateGlobalDiscountStatus(status: DiscountStatus): void {
    this._globalDiscountStatus = status;
  }

  updateNotes(notes: string): void {
    this._notes = notes;
  }

  cancel(): void {
    this._status = OrderStatusEnum.CANCELLED;
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
      attributes: this._attributes,
      pricingRuleId: this._pricingRuleId,
      status: this._status,
      
      // Motor de composição
      unitCostAtSale: this._unitCostAtSale,
      unitPriceAtSale: this._unitPriceAtSale,
      profitAtSale: this._profitAtSale,
      compositionSnapshot: this._compositionSnapshot,
      confirmedAt: this._confirmedAt,

      discountStatus: this._discountStatus,
      discountItem: this._discountItem.value,
      discountGlobal: this._discountGlobal.value,
      commissionRateApplied: this._commissionRateApplied,
      commissionAmount: this._commissionAmount.value,
      authorizationRequestId: this._authorizationRequestId
    };
  }
}
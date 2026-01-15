import { Money } from '../../../../shared/domain/value-objects/Money';
import { OrderNumber } from '../value-objects/OrderNumber';
import { OrderStatus, OrderStatusEnum } from '../value-objects/OrderStatus';
import { OrderItem } from './OrderItem';

export interface OrderProps {
  id?: string;
  orderNumber: OrderNumber;
  customerId: string;
  organizationId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  deliveryDate?: Date;
  validUntil: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Order {
  private _id?: string;
  private _orderNumber: OrderNumber;
  private _customerId: string;
  private _organizationId: string;
  private _status: OrderStatus;
  private _items: OrderItem[];
  private _subtotal: Money;
  private _discount: Money;
  private _tax: Money;
  private _total: Money;
  private _deliveryDate?: Date;
  private _validUntil: Date;
  private _notes?: string;
  private _createdAt?: Date;
  private _updatedAt?: Date;

  constructor(props: OrderProps) {
    this._id = props.id;
    this._orderNumber = props.orderNumber;
    this._customerId = props.customerId;
    this._organizationId = props.organizationId;
    this._status = props.status;
    this._items = props.items;
    this._subtotal = props.subtotal;
    this._discount = props.discount;
    this._tax = props.tax;
    this._total = props.total;
    this._deliveryDate = props.deliveryDate;
    this._validUntil = props.validUntil;
    this._notes = props.notes;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (!this._customerId || this._customerId.trim().length === 0) {
      throw new Error('Customer ID is required');
    }

    if (!this._organizationId || this._organizationId.trim().length === 0) {
      throw new Error('Organization ID is required');
    }

    if (this._items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    if (this._validUntil < new Date()) {
      throw new Error('Valid until date cannot be in the past');
    }
  }

  // Getters
  get id(): string | undefined {
    return this._id;
  }

  get orderNumber(): OrderNumber {
    return this._orderNumber;
  }

  get customerId(): string {
    return this._customerId;
  }

  get organizationId(): string {
    return this._organizationId;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get items(): OrderItem[] {
    return [...this._items]; // Retorna cópia para evitar mutação externa
  }

  get subtotal(): Money {
    return this._subtotal;
  }

  get discount(): Money {
    return this._discount;
  }

  get tax(): Money {
    return this._tax;
  }

  get total(): Money {
    return this._total;
  }

  get deliveryDate(): Date | undefined {
    return this._deliveryDate;
  }

  get validUntil(): Date {
    return this._validUntil;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  get createdAt(): Date | undefined {
    return this._createdAt;
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  // Métodos de negócio
  addItem(item: OrderItem): void {
    this._items.push(item);
    this.recalculateTotals();
  }

  removeItem(itemId: string): void {
    this._items = this._items.filter(item => item.id !== itemId);
    this.recalculateTotals();
  }

  updateItem(itemId: string, updatedItem: OrderItem): void {
    const index = this._items.findIndex(item => item.id === itemId);
    if (index === -1) {
      throw new Error('Item not found');
    }
    this._items[index] = updatedItem;
    this.recalculateTotals();
  }

  changeStatus(newStatus: OrderStatus): void {
    if (!this._status.canTransitionTo(newStatus)) {
      throw new Error(`Cannot transition from ${this._status.toString()} to ${newStatus.toString()}`);
    }
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  approve(): void {
    this.changeStatus(OrderStatus.approved());
  }

  startProduction(): void {
    this.changeStatus(OrderStatus.inProduction());
  }

  finish(): void {
    this.changeStatus(OrderStatus.finished());
  }

  deliver(): void {
    this.changeStatus(OrderStatus.delivered());
  }

  cancel(): void {
    this.changeStatus(OrderStatus.cancelled());
  }

  updateDeliveryDate(date: Date): void {
    this._deliveryDate = date;
    this._updatedAt = new Date();
  }

  updateNotes(notes: string): void {
    this._notes = notes;
    this._updatedAt = new Date();
  }

  updateDetails(details: {
    customerId?: string;
    items?: OrderItem[];
    subtotal?: Money;
    total?: Money;
    deliveryDate?: Date;
    validUntil?: Date;
    notes?: string;
  }): void {
    if (!this.canBeModified()) {
      throw new Error('Order cannot be modified in current status');
    }

    if (details.customerId !== undefined) {
      this._customerId = details.customerId;
    }
    
    if (details.items !== undefined) {
      this._items = details.items;
    }
    
    if (details.subtotal !== undefined) {
      this._subtotal = details.subtotal;
    }
    
    if (details.total !== undefined) {
      this._total = details.total;
    }
    
    if (details.deliveryDate !== undefined) {
      this._deliveryDate = details.deliveryDate;
    }
    
    if (details.validUntil !== undefined) {
      this._validUntil = details.validUntil;
    }
    
    if (details.notes !== undefined) {
      this._notes = details.notes;
    }

    this._updatedAt = new Date();
    this.validate();
  }

  applyDiscount(discount: Money): void {
    this._discount = discount;
    this.recalculateTotals();
  }

  applyTax(tax: Money): void {
    this._tax = tax;
    this.recalculateTotals();
  }

  private recalculateTotals(): void {
    this._subtotal = this._items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      Money.zero()
    );
    
    this._total = this._subtotal
      .subtract(this._discount)
      .add(this._tax);
    
    this._updatedAt = new Date();
  }

  isExpired(): boolean {
    return this._validUntil < new Date() && this._status.isDraft();
  }

  canBeModified(): boolean {
    return this._status.isDraft();
  }

  getTotalArea(): number {
    return this._items.reduce((total, item) => {
      return total + (item.dimensions.areaInSquareMeters * item.quantity);
    }, 0);
  }

  equals(other: Order): boolean {
    return this._id === other._id;
  }

  toJSON(): any {
    return {
      id: this._id,
      orderNumber: this._orderNumber.value,
      customerId: this._customerId,
      organizationId: this._organizationId,
      status: this._status.value,
      items: this._items.map(item => item.toJSON()),
      subtotal: this._subtotal.value,
      discount: this._discount.value,
      tax: this._tax.value,
      total: this._total.value,
      deliveryDate: this._deliveryDate,
      validUntil: this._validUntil,
      notes: this._notes,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  static create(props: Omit<OrderProps, 'id' | 'createdAt' | 'updatedAt'>): Order {
    const now = new Date();
    return new Order({
      ...props,
      createdAt: now,
      updatedAt: now
    });
  }
}
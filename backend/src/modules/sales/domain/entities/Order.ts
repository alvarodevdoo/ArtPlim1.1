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
  approvedAt?: Date;
  inProductionAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancelledById?: string;
  cancellationReason?: string;
  cancellationPaymentAction?: string;
  cancellationRefundAmount?: number;
  processStatusId?: string;
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
  private _approvedAt?: Date;
  private _inProductionAt?: Date;
  private _finishedAt?: Date;
  private _deliveredAt?: Date;
  private _cancelledAt?: Date;
  private _cancelledById?: string;
  private _cancellationReason?: string;
  private _cancellationPaymentAction?: string;
  private _cancellationRefundAmount?: Money;
  private _processStatusId?: string;

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
    this._approvedAt = props.approvedAt;
    this._inProductionAt = props.inProductionAt;
    this._finishedAt = props.finishedAt;
    this._deliveredAt = props.deliveredAt;
    this._cancelledAt = props.cancelledAt;
    this._cancelledById = props.cancelledById;
    this._cancellationReason = props.cancellationReason;
    this._cancellationPaymentAction = props.cancellationPaymentAction;
    this._cancellationRefundAmount = props.cancellationRefundAmount ? new Money(Number(props.cancellationRefundAmount)) : undefined;
    this._processStatusId = props.processStatusId;

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

    // Remover validação de data passada para permitir atualizações
    // if (this._validUntil < new Date()) {
    //   throw new Error('Valid until date cannot be in the past');
    // }
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

  get approvedAt(): Date | undefined {
    return this._approvedAt;
  }

  get inProductionAt(): Date | undefined {
    return this._inProductionAt;
  }

  get finishedAt(): Date | undefined {
    return this._finishedAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  get cancelledAt(): Date | undefined {
    return this._cancelledAt;
  }

  get cancelledById(): string | undefined {
    return this._cancelledById;
  }

  get cancellationReason(): string | undefined {
    return this._cancellationReason;
  }

  get cancellationPaymentAction(): string | undefined {
    return this._cancellationPaymentAction;
  }

  get cancellationRefundAmount(): Money | undefined {
    return this._cancellationRefundAmount;
  }

  get processStatusId(): string | undefined {
    return this._processStatusId;
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

    // Set status timestamps
    if (newStatus.isApproved() && !this._approvedAt) this._approvedAt = new Date();
    if (newStatus.isInProduction() && !this._inProductionAt) this._inProductionAt = new Date();
    if (newStatus.isFinished() && !this._finishedAt) this._finishedAt = new Date();
    if (newStatus.isDelivered() && !this._deliveredAt) this._deliveredAt = new Date();
    if (newStatus.isCancelled() && !this._cancelledAt) this._cancelledAt = new Date();
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

  cancel(details?: { userId?: string, reason?: string, paymentAction?: string, refundAmount?: number }): void {
    console.log(`[Order Domain] Executando cancel() para o pedido ${this._id}`, details);
    this.changeStatus(OrderStatus.cancelled());
    if (details) {
      this._cancelledById = details.userId;
      this._cancellationReason = details.reason;
      this._cancellationPaymentAction = details.paymentAction;
      this._cancellationRefundAmount = details.refundAmount ? new Money(details.refundAmount) : undefined;
      console.log(`[Order Domain] Campos setados: Reason=${this._cancellationReason}, Action=${this._cancellationPaymentAction}, Amount=${this._cancellationRefundAmount?.value}`);
    }
    this._cancelledAt = new Date();
    
    // Propagar cancelamento para todos os itens
    this._items.forEach(item => {
      if ((item as any).cancel) {
        (item as any).cancel();
      } else if ((item as any).status !== undefined) {
        (item as any).status = OrderStatusEnum.CANCELLED;
      }
    });
    
    console.log(`[Order Domain] CancelledAt setado para: ${this._cancelledAt} e itens cancelados`);
  }

  updateDeliveryDate(date: Date): void {
    this._deliveryDate = date;
    this._updatedAt = new Date();
  }

  updateProcessStatusId(id: string): void {
    this._processStatusId = id;
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
    return !this._status.isDelivered();
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
      updatedAt: this._updatedAt,
      approvedAt: this._approvedAt,
      inProductionAt: this._inProductionAt,
      finishedAt: this._finishedAt,
      deliveredAt: this._deliveredAt,
      cancelledAt: this._cancelledAt,
      cancelledById: this._cancelledById,
      cancellationReason: this._cancellationReason,
      cancellationPaymentAction: this._cancellationPaymentAction,
      cancellationRefundAmount: this._cancellationRefundAmount?.value,
      processStatusId: this._processStatusId
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
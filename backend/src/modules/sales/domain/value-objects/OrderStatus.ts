export enum OrderStatusEnum {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  FINISHED = 'FINISHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export class OrderStatus {
  private readonly _value: OrderStatusEnum;

  constructor(value: OrderStatusEnum) {
    this._value = value;
  }

  get value(): OrderStatusEnum {
    return this._value;
  }

  equals(other: OrderStatus): boolean {
    return this._value === other._value;
  }

  isDraft(): boolean {
    return this._value === OrderStatusEnum.DRAFT;
  }

  isApproved(): boolean {
    return this._value === OrderStatusEnum.APPROVED;
  }

  isInProduction(): boolean {
    return this._value === OrderStatusEnum.IN_PRODUCTION;
  }

  isFinished(): boolean {
    return this._value === OrderStatusEnum.FINISHED;
  }

  isDelivered(): boolean {
    return this._value === OrderStatusEnum.DELIVERED;
  }

  isCancelled(): boolean {
    return this._value === OrderStatusEnum.CANCELLED;
  }

  canTransitionTo(newStatus: OrderStatus): boolean {
    const transitions: Record<OrderStatusEnum, OrderStatusEnum[]> = {
      [OrderStatusEnum.DRAFT]: [OrderStatusEnum.APPROVED, OrderStatusEnum.CANCELLED],
      [OrderStatusEnum.APPROVED]: [OrderStatusEnum.IN_PRODUCTION, OrderStatusEnum.CANCELLED],
      [OrderStatusEnum.IN_PRODUCTION]: [OrderStatusEnum.FINISHED, OrderStatusEnum.CANCELLED],
      [OrderStatusEnum.FINISHED]: [OrderStatusEnum.DELIVERED],
      [OrderStatusEnum.DELIVERED]: [],
      [OrderStatusEnum.CANCELLED]: []
    };

    return transitions[this._value].includes(newStatus._value);
  }

  toString(): string {
    const labels: Record<OrderStatusEnum, string> = {
      [OrderStatusEnum.DRAFT]: 'Rascunho',
      [OrderStatusEnum.APPROVED]: 'Aprovado',
      [OrderStatusEnum.IN_PRODUCTION]: 'Em Produção',
      [OrderStatusEnum.FINISHED]: 'Finalizado',
      [OrderStatusEnum.DELIVERED]: 'Entregue',
      [OrderStatusEnum.CANCELLED]: 'Cancelado'
    };

    return labels[this._value];
  }

  toJSON(): string {
    return this._value;
  }

  static draft(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.DRAFT);
  }

  static approved(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.APPROVED);
  }

  static inProduction(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.IN_PRODUCTION);
  }

  static finished(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.FINISHED);
  }

  static delivered(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.DELIVERED);
  }

  static cancelled(): OrderStatus {
    return new OrderStatus(OrderStatusEnum.CANCELLED);
  }
}
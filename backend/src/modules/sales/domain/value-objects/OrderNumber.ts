export class OrderNumber {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Order number cannot be empty');
    }
    
    // Validar formato PED-XXXXXX
    const pattern = /^PED-\d{6}$/;
    if (!pattern.test(value)) {
      throw new Error('Order number must follow format PED-XXXXXX');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrderNumber): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }

  static generate(sequence: number): OrderNumber {
    const paddedSequence = String(sequence).padStart(6, '0');
    return new OrderNumber(`PED-${paddedSequence}`);
  }
}
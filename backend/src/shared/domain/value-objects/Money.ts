export class Money {
  private readonly _value: number;

  constructor(value: number) {
    if (value < 0) {
      throw new Error('Money value cannot be negative');
    }
    this._value = Math.round(value * 100) / 100; // Arredondar para 2 casas decimais
  }

  get value(): number {
    return this._value;
  }

  add(other: Money): Money {
    return new Money(this._value + other._value);
  }

  subtract(other: Money): Money {
    return new Money(this._value - other._value);
  }

  multiply(factor: number): Money {
    return new Money(this._value * factor);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new Money(this._value / divisor);
  }

  equals(other: Money): boolean {
    return this._value === other._value;
  }

  isGreaterThan(other: Money): boolean {
    return this._value > other._value;
  }

  isLessThan(other: Money): boolean {
    return this._value < other._value;
  }

  toString(): string {
    return `R$ ${this._value.toFixed(2)}`;
  }

  toJSON(): number {
    return this._value;
  }

  static zero(): Money {
    return new Money(0);
  }

  static fromCents(cents: number): Money {
    return new Money(cents / 100);
  }
}
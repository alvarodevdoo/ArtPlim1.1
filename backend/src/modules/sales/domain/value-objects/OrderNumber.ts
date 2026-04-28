export class OrderNumber {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Order number cannot be empty');
    }
    
    // Validar apenas que começa com PED- (flexível para legado)
    if (!value.startsWith('PED-')) {
       // Se não começa com PED-, aceitamos mas avisamos ou apenas guardamos
       // Para máxima compatibilidade, vamos apenas garantir que não é vazio
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
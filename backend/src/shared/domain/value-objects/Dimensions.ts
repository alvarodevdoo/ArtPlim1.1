export class Dimensions {
  private readonly _width: number;
  private readonly _height: number;

  constructor(width: number, height: number) {
    if (width < 0 || height < 0) {
      throw new Error('Dimensions cannot be negative');
    }
    this._width = width || 0;
    this._height = height || 0;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get area(): number {
    return this._width * this._height;
  }

  get areaInSquareMeters(): number {
    return this.area / 1_000_000; // Convertendo de mm² para m²
  }

  get perimeter(): number {
    return 2 * (this._width + this._height);
  }

  get perimeterInMeters(): number {
    return this.perimeter / 1000; // Convertendo de mm para metros
  }

  equals(other: Dimensions): boolean {
    return this._width === other._width && this._height === other._height;
  }

  toString(): string {
    return `${this._width}mm x ${this._height}mm`;
  }

  toJSON(): { width: number; height: number } {
    return {
      width: this._width,
      height: this._height
    };
  }

  static fromMeters(widthM: number, heightM: number): Dimensions {
    return new Dimensions(widthM * 1000, heightM * 1000);
  }

  static fromCentimeters(widthCm: number, heightCm: number): Dimensions {
    return new Dimensions(widthCm * 10, heightCm * 10);
  }
}
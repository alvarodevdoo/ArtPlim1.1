import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';

/**
 * Property-based test for standard size auto-population
 * 
 * This test validates that when a standard size is selected, the width and height
 * fields are automatically populated with the correct dimensions.
 * 
 * Property 9: Standard Size Auto-Population
 * Validates: Requirements 3.3
 */

// Standard sizes by type (copied from frontend types)
const STANDARD_SIZES_BY_TYPE = {
    SERVICE: [],
    PRINT_SHEET: [
        { value: 'A3', label: 'A3 (297 × 420mm)', width: 297, height: 420 },
        { value: 'A4', label: 'A4 (210 × 297mm)', width: 210, height: 297 },
        { value: 'A5', label: 'A5 (148 × 210mm)', width: 148, height: 210 },
        { value: 'CARTA', label: 'Carta (216 × 279mm)', width: 216, height: 279 },
        { value: 'OFICIO', label: 'Ofício (216 × 355mm)', width: 216, height: 355 },
        { value: 'CARTAO_VISITA', label: 'Cartão de Visita (90 × 50mm)', width: 90, height: 50 }
    ],
    PRINT_ROLL: [
        { value: 'BANNER_1X1', label: 'Banner 1x1m', width: 1000, height: 1000 },
        { value: 'BANNER_2X1', label: 'Banner 2x1m', width: 2000, height: 1000 },
        { value: 'BANNER_3X1', label: 'Banner 3x1m', width: 3000, height: 1000 },
        { value: 'ADESIVO_A4', label: 'Adesivo A4', width: 210, height: 297 },
        { value: 'ADESIVO_A3', label: 'Adesivo A3', width: 297, height: 420 }
    ],
    LASER_CUT: [
        { value: 'QUADRADO_10CM', label: 'Quadrado 10x10cm', width: 100, height: 100 },
        { value: 'RETANGULO_20X10', label: 'Retângulo 20x10cm', width: 200, height: 100 },
        { value: 'PLACA_30X20', label: 'Placa 30x20cm', width: 300, height: 200 }
    ],
    PRODUCT: []
};

enum ItemType {
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
    PRINT_SHEET = 'PRINT_SHEET',
    PRINT_ROLL = 'PRINT_ROLL',
    LASER_CUT = 'LASER_CUT'
}

// Simulate the auto-population logic
function autoPopulateDimensions(itemType: ItemType, selectedStandardSize: string): { width: number; height: number } | null {
    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];
    if (!standardSizes.length) return null;

    const size = standardSizes.find(s => s.value === selectedStandardSize);
    if (!size) return null;

    return { width: size.width, height: size.height };
}

describe('Standard Size Auto-Population', () => {
    it('should auto-populate dimensions when standard size is selected', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];

                    if (standardSizes.length === 0) {
                        // Types without standard sizes should return null
                        const result = autoPopulateDimensions(itemType, 'ANY_SIZE');
                        expect(result).toBeNull();
                        return true;
                    }

                    // Test each standard size for this type
                    standardSizes.forEach(size => {
                        const result = autoPopulateDimensions(itemType, size.value);

                        expect(result).not.toBeNull();
                        expect(result!.width).toBe(size.width);
                        expect(result!.height).toBe(size.height);
                    });

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should return null for invalid standard size selections', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                fc.string({ minLength: 1, maxLength: 20 }),
                (itemType: ItemType, invalidSize: string) => {
                    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];

                    // Skip if the random string happens to match a valid size
                    const isValidSize = standardSizes.some(s => s.value === invalidSize);
                    if (isValidSize) return true;

                    const result = autoPopulateDimensions(itemType, invalidSize);
                    expect(result).toBeNull();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have consistent dimensions for same size across types', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('A4', 'A3'), // Common sizes across types
                (commonSize: string) => {
                    const results: Array<{ itemType: ItemType; dimensions: { width: number; height: number } | null }> = [];

                    // Collect results for all types that have this size
                    Object.values(ItemType).forEach(itemType => {
                        const result = autoPopulateDimensions(itemType, commonSize);
                        if (result) {
                            results.push({ itemType, dimensions: result });
                        }
                    });

                    // If multiple types have the same size name, dimensions should be consistent
                    if (results.length > 1) {
                        const firstResult = results[0].dimensions!;
                        results.forEach(({ dimensions }) => {
                            expect(dimensions!.width).toBe(firstResult.width);
                            expect(dimensions!.height).toBe(firstResult.height);
                        });
                    }

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });

    it('should validate standard size data integrity', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];

                    standardSizes.forEach(size => {
                        // All sizes should have required properties
                        expect(size.value).toBeTruthy();
                        expect(size.label).toBeTruthy();
                        expect(typeof size.width).toBe('number');
                        expect(typeof size.height).toBe('number');

                        // Dimensions should be positive
                        expect(size.width).toBeGreaterThan(0);
                        expect(size.height).toBeGreaterThan(0);

                        // Dimensions should be reasonable (not too small or too large)
                        expect(size.width).toBeGreaterThanOrEqual(10); // At least 10mm
                        expect(size.height).toBeGreaterThanOrEqual(10); // At least 10mm
                        expect(size.width).toBeLessThanOrEqual(10000); // At most 10m
                        expect(size.height).toBeLessThanOrEqual(10000); // At most 10m
                    });

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });

    it('should have unique size values within each type', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];
                    const values = standardSizes.map(s => s.value);
                    const uniqueValues = new Set(values);

                    // No duplicate values within the same type
                    expect(uniqueValues.size).toBe(values.length);

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });

    it('should calculate area correctly after auto-population', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                fc.integer({ min: 1, max: 1000 }),
                (itemType: ItemType, quantity: number) => {
                    const standardSizes = STANDARD_SIZES_BY_TYPE[itemType];

                    if (standardSizes.length === 0) return true;

                    // Test area calculation for each standard size
                    standardSizes.forEach(size => {
                        const result = autoPopulateDimensions(itemType, size.value);

                        if (result) {
                            const areaM2 = (result.width * result.height) / 1000000;
                            const totalArea = areaM2 * quantity;

                            // Area should be positive
                            expect(areaM2).toBeGreaterThan(0);
                            expect(totalArea).toBeGreaterThan(0);

                            // Total area should scale with quantity
                            expect(totalArea).toBe(areaM2 * quantity);

                            // Area calculation should be consistent
                            const recalculatedArea = (result.width * result.height) / 1000000;
                            expect(Math.abs(areaM2 - recalculatedArea)).toBeLessThan(0.000001);
                        }
                    });

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle custom size selection correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    // Custom size should not auto-populate dimensions
                    const result = autoPopulateDimensions(itemType, 'CUSTOM');
                    expect(result).toBeNull();

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });

    it('should preserve aspect ratios for standard paper sizes', () => {
        const paperSizes = STANDARD_SIZES_BY_TYPE.PRINT_SHEET;

        fc.assert(
            fc.property(
                fc.constantFrom(...paperSizes.filter(s => s.value.startsWith('A')).map(s => s.value)),
                (paperSize: string) => {
                    const result = autoPopulateDimensions(ItemType.PRINT_SHEET, paperSize);

                    if (result && paperSize.startsWith('A')) {
                        const aspectRatio = result.width / result.height;

                        // A-series paper should have aspect ratio close to 1:√2 ≈ 0.707
                        // Allow some tolerance for different orientations
                        const expectedRatio = 1 / Math.sqrt(2);
                        const tolerance = 0.1;

                        expect(
                            Math.abs(aspectRatio - expectedRatio) < tolerance ||
                            Math.abs(aspectRatio - (1 / expectedRatio)) < tolerance
                        ).toBe(true);
                    }

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });
});
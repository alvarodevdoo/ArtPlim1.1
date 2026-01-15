/**
 * Property-Based Tests for Total Area Calculation
 * Feature: tipos-produtos, Property 6: Total Area Calculation
 * Validates: Requirements 9.2
 */

import fc from 'fast-check';
import { AreaCalculationService } from '../../modules/sales/application/services/AreaCalculationService';

describe('Total Area Calculation Properties', () => {
    let areaService: AreaCalculationService;

    beforeEach(() => {
        areaService = new AreaCalculationService();
    });

    /**
     * Property 6: Total Area Calculation
     * For any valid area and quantity, the total area should equal area × quantity
     */
    test('should calculate total area as area multiplied by quantity', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (area: number, quantity: number) => {
                const totalArea = areaService.calculateTotalArea(area, quantity);
                const expectedTotalArea = area * quantity;

                // Usar tolerância para comparação de floats
                const tolerance = 0.000001;
                expect(Math.abs(totalArea - expectedTotalArea)).toBeLessThan(tolerance);

                // Total area deve ser maior ou igual à área unitária
                expect(totalArea).toBeGreaterThanOrEqual(area);

                // Para quantidade 1, total area deve ser igual à área unitária
                if (quantity === 1) {
                    expect(Math.abs(totalArea - area)).toBeLessThan(tolerance);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should scale linearly with quantity
     * For any area, doubling the quantity should double the total area
     */
    test('should scale linearly with quantity', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 500 }),
            (area: number, quantity: number) => {
                const totalArea1 = areaService.calculateTotalArea(area, quantity);
                const totalArea2 = areaService.calculateTotalArea(area, quantity * 2);

                // Dobrar a quantidade deve dobrar a área total
                const expectedDoubledArea = totalArea1 * 2;
                const tolerance = 0.000001;
                expect(Math.abs(totalArea2 - expectedDoubledArea)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should be commutative for equivalent calculations
     * calculateTotalArea(area, quantity) should equal calculateTotalArea(area * quantity, 1)
     */
    test('should be equivalent to single unit with multiplied area', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(10) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 100 }),
            (area: number, quantity: number) => {
                const totalArea1 = areaService.calculateTotalArea(area, quantity);
                const totalArea2 = areaService.calculateTotalArea(area * quantity, 1);

                const tolerance = 0.000001;
                expect(Math.abs(totalArea1 - totalArea2)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area calculation should reject invalid inputs
     * For any zero, negative, or non-finite area/quantity, calculation should throw error
     */
    test('should reject invalid area values', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-100), max: Math.fround(-0.001) }),
                fc.constant(NaN),
                fc.constant(Infinity),
                fc.constant(-Infinity)
            ),
            fc.integer({ min: 1, max: 100 }),
            (invalidArea: number, quantity: number) => {
                expect(() => {
                    areaService.calculateTotalArea(invalidArea, quantity);
                }).toThrow('Area must be a positive finite number');

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area calculation should reject invalid quantities
     * For any zero, negative, or non-integer quantity, calculation should throw error
     */
    test('should reject invalid quantity values', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.oneof(
                fc.constant(0),
                fc.integer({ min: -100, max: -1 }),
                fc.float({ min: Math.fround(0.1), max: Math.fround(10.9) }), // Non-integer
                fc.constant(NaN),
                fc.constant(Infinity),
                fc.constant(-Infinity)
            ),
            (area: number, invalidQuantity: number) => {
                expect(() => {
                    areaService.calculateTotalArea(area, invalidQuantity);
                }).toThrow('Quantity must be a positive integer');

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should be additive for multiple items
     * Total area of (area1 × qty1) + (area2 × qty2) should equal sum of individual calculations
     */
    test('should be additive for multiple items', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(50) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 100 }),
            fc.float({ min: Math.fround(0.001), max: Math.fround(50) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 100 }),
            (area1: number, qty1: number, area2: number, qty2: number) => {
                const totalArea1 = areaService.calculateTotalArea(area1, qty1);
                const totalArea2 = areaService.calculateTotalArea(area2, qty2);
                const combinedTotal = totalArea1 + totalArea2;

                // Calcular área total combinada diretamente
                const directCombined = (area1 * qty1) + (area2 * qty2);

                const tolerance = 0.000001;
                expect(Math.abs(combinedTotal - directCombined)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should maintain precision for large quantities
     * Even with large quantities, the calculation should remain accurate
     */
    test('should maintain precision for large quantities', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(1) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1000, max: 10000 }),
            (area: number, largeQuantity: number) => {
                const totalArea = areaService.calculateTotalArea(area, largeQuantity);
                const expectedTotalArea = area * largeQuantity;

                // Usar tolerância relativa para grandes números
                const relativeTolerance = 0.000001;
                const absoluteTolerance = Math.max(expectedTotalArea * relativeTolerance, 0.000001);
                expect(Math.abs(totalArea - expectedTotalArea)).toBeLessThan(absoluteTolerance);

                // Total area deve ser positiva
                expect(totalArea).toBeGreaterThan(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should work with very small areas
     * Even with very small unit areas, total calculation should be accurate
     */
    test('should handle very small areas accurately', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.000001), max: Math.fround(0.001) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (smallArea: number, quantity: number) => {
                const totalArea = areaService.calculateTotalArea(smallArea, quantity);
                const expectedTotalArea = smallArea * quantity;

                // Para áreas muito pequenas, usar tolerância absoluta pequena
                const tolerance = 0.000000001;
                expect(Math.abs(totalArea - expectedTotalArea)).toBeLessThan(tolerance);

                // Total area deve ser maior que a área unitária (exceto para qty = 1)
                if (quantity > 1) {
                    expect(totalArea).toBeGreaterThan(smallArea);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area calculation should be consistent with dimension-based calculation
     * Total area from calculateAreaFromDimensions should match calculateTotalArea
     */
    test('should be consistent with dimension-based calculation', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (width: number, height: number, quantity: number) => {
                // Calcular usando método de dimensões
                const dimensionResult = areaService.calculateAreaFromDimensions({ width, height, quantity });

                // Calcular usando método de área total separado
                const unitArea = areaService.calculateArea(width, height);
                const totalAreaSeparate = areaService.calculateTotalArea(unitArea, quantity);

                // Devem ser iguais
                const tolerance = 0.000001;
                expect(Math.abs(dimensionResult.totalArea - totalAreaSeparate)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area should be monotonic with quantity
     * For any fixed area, increasing quantity should increase or maintain total area
     */
    test('should be monotonic with quantity', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 500 }),
            fc.integer({ min: 1, max: 500 }),
            (area: number, qty1: number, qty2: number) => {
                const totalArea1 = areaService.calculateTotalArea(area, qty1);
                const totalArea2 = areaService.calculateTotalArea(area, qty2);

                if (qty1 < qty2) {
                    expect(totalArea1).toBeLessThanOrEqual(totalArea2);
                } else if (qty1 > qty2) {
                    expect(totalArea1).toBeGreaterThanOrEqual(totalArea2);
                } else {
                    // qty1 === qty2
                    const tolerance = 0.000001;
                    expect(Math.abs(totalArea1 - totalArea2)).toBeLessThan(tolerance);
                }

                return true;
            }
        ), { numRuns: 100 });
    });
});
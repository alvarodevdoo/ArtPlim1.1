/**
 * Property-Based Tests for Area Calculation Accuracy
 * Feature: tipos-produtos, Property 5: Area Calculation Accuracy
 * Validates: Requirements 2.3, 9.1
 */

import fc from 'fast-check';
import { AreaCalculationService, DimensionInput } from '../../modules/sales/application/services/AreaCalculationService';

describe('Area Calculation Accuracy Properties', () => {
    let areaService: AreaCalculationService;

    beforeEach(() => {
        areaService = new AreaCalculationService();
    });

    /**
     * Property 5: Area Calculation Accuracy
     * For any valid width and height values, the calculated area
     * should equal (width × height) / 1,000,000 in square meters
     */
    test('should calculate area accurately from dimensions in mm to m²', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(10000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(10000) }).filter(n => !isNaN(n) && isFinite(n)),
            (width: number, height: number) => {
                const calculatedArea = areaService.calculateArea(width, height);
                const expectedArea = (width * height) / 1_000_000;

                // Usar tolerância para comparação de floats
                const tolerance = 0.000001;
                expect(Math.abs(calculatedArea - expectedArea)).toBeLessThan(tolerance);

                // Área deve ser positiva
                expect(calculatedArea).toBeGreaterThan(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area calculation should be commutative
     * For any width and height, calculateArea(width, height) should equal calculateArea(height, width)
     */
    test('should be commutative for width and height', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            (width: number, height: number) => {
                const area1 = areaService.calculateArea(width, height);
                const area2 = areaService.calculateArea(height, width);

                const tolerance = 0.000001;
                expect(Math.abs(area1 - area2)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area calculation should scale linearly
     * For any dimensions, doubling both width and height should quadruple the area
     */
    test('should scale quadratically with dimensions', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(2500) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(2500) }).filter(n => !isNaN(n) && isFinite(n)),
            (width: number, height: number) => {
                const originalArea = areaService.calculateArea(width, height);
                const doubledArea = areaService.calculateArea(width * 2, height * 2);

                // Área dobrada deve ser 4x a área original
                const expectedDoubledArea = originalArea * 4;
                const tolerance = 0.000001;
                expect(Math.abs(doubledArea - expectedDoubledArea)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area calculation should reject invalid inputs
     * For any zero, negative, or non-finite dimensions, calculation should throw error
     */
    test('should reject invalid dimensions', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) }),
                fc.constant(NaN),
                fc.constant(Infinity),
                fc.constant(-Infinity)
            ),
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) }),
                fc.constant(NaN),
                fc.constant(Infinity),
                fc.constant(-Infinity)
            ),
            (width: number, height: number) => {
                expect(() => {
                    areaService.calculateArea(width, height);
                }).toThrow();

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Unit conversion consistency
     * Converting mm² to m² and back should preserve the original value
     */
    test('should maintain consistency in unit conversions', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(1000000) }).filter(n => !isNaN(n) && isFinite(n)),
            (areaInMm2: number) => {
                const areaInM2 = areaService.convertMm2ToM2(areaInMm2);
                const backToMm2 = areaService.convertM2ToMm2(areaInM2);

                const tolerance = 0.001; // Tolerância maior para conversões
                expect(Math.abs(backToMm2 - areaInMm2)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area from dimensions should be consistent
     * Calculating area from dimensions should match individual calculations
     */
    test('should calculate area from dimensions consistently', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (width: number, height: number, quantity: number) => {
                const input: DimensionInput = { width, height, quantity };
                const result = areaService.calculateAreaFromDimensions(input);

                // Área unitária deve ser consistente
                const expectedArea = areaService.calculateArea(width, height);
                const tolerance = 0.000001;
                expect(Math.abs(result.area - expectedArea)).toBeLessThan(tolerance);

                // Área total deve ser consistente
                const expectedTotalArea = areaService.calculateTotalArea(result.area, quantity);
                expect(Math.abs(result.totalArea - expectedTotalArea)).toBeLessThan(tolerance);

                // Dados de entrada devem ser preservados
                expect(result.width).toBe(width);
                expect(result.height).toBe(height);
                expect(result.quantity).toBe(quantity);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Price calculation by area should be linear
     * For any area and price per m², the total price should be area × price
     */
    test('should calculate price by area linearly', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
            (areaInM2: number, pricePerM2: number) => {
                const totalPrice = areaService.calculatePriceByArea(areaInM2, pricePerM2);
                const expectedPrice = areaInM2 * pricePerM2;

                const tolerance = 0.001;
                expect(Math.abs(totalPrice - expectedPrice)).toBeLessThan(tolerance);

                // Preço deve ser não-negativo
                expect(totalPrice).toBeGreaterThanOrEqual(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area formatting should be consistent
     * For any valid area, formatting should produce a valid string with units
     */
    test('should format area consistently', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
            (areaInM2: number) => {
                const formatted = areaService.formatAreaForDisplay(areaInM2);

                // Deve ser uma string não-vazia
                expect(typeof formatted).toBe('string');
                expect(formatted.length).toBeGreaterThan(0);

                // Deve conter unidade (m² ou cm²)
                expect(formatted).toMatch(/\s*(m²|cm²)$/);

                // Para áreas pequenas, deve usar cm²
                if (areaInM2 < 0.01) {
                    expect(formatted).toContain('cm²');
                } else {
                    expect(formatted).toContain('m²');
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Update area calculation should preserve unchanged values
     * When updating only some dimensions, unchanged values should remain the same
     */
    test('should preserve unchanged values in updates', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            (width: number, height: number, quantity: number, newWidth: number) => {
                const input: DimensionInput = { width, height, quantity };
                const originalResult = areaService.calculateAreaFromDimensions(input);

                // Atualizar apenas a largura
                const updatedResult = areaService.updateAreaCalculation(
                    originalResult,
                    newWidth,
                    undefined, // height não muda
                    undefined  // quantity não muda
                );

                // Altura e quantidade devem permanecer iguais
                expect(updatedResult.height).toBe(height);
                expect(updatedResult.quantity).toBe(quantity);

                // Largura deve ser atualizada
                expect(updatedResult.width).toBe(newWidth);

                // Área deve ser recalculada corretamente
                const expectedArea = areaService.calculateArea(newWidth, height);
                const tolerance = 0.000001;
                expect(Math.abs(updatedResult.area - expectedArea)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Calculation info should contain all relevant data
     * For any valid calculation result, the info string should contain key information
     */
    test('should provide comprehensive calculation info', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (width: number, height: number, quantity: number) => {
                const input: DimensionInput = { width, height, quantity };
                const result = areaService.calculateAreaFromDimensions(input);
                const info = areaService.getCalculationInfo(result);

                // Deve ser uma string não-vazia
                expect(typeof info).toBe('string');
                expect(info.length).toBeGreaterThan(0);

                // Deve conter informações sobre dimensões
                expect(info).toContain(`${width}mm`);
                expect(info).toContain(`${height}mm`);

                // Deve conter informações sobre quantidade
                expect(info).toContain(`${quantity}`);

                // Deve conter unidades de área
                expect(info).toMatch(/(m²|cm²)/);

                return true;
            }
        ), { numRuns: 100 });
    });
});
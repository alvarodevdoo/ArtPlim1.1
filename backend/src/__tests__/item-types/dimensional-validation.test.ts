/**
 * Property-Based Tests for Dimensional Field Requirements
 * Feature: tipos-produtos, Property 3: Dimensional Field Requirements
 * Validates: Requirements 2.2, 7.2
 */

import fc from 'fast-check';
import { ItemValidationService, ItemValidationData } from '../../modules/sales/application/services/ItemValidationService';
import { ItemType } from '@prisma/client';

describe('Dimensional Field Requirements Properties', () => {
    let validationService: ItemValidationService;

    beforeEach(() => {
        validationService = new ItemValidationService();
    });

    /**
     * Property 3: Dimensional Field Requirements
     * For any item with type PRINT_SHEET, PRINT_ROLL, or LASER_CUT, 
     * width and height fields should be required and greater than zero
     */
    test('should require positive width and height for dimensional types', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }), { nil: undefined }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }), { nil: undefined }),
            (itemType: ItemType, productId: string, quantity: number, width: number | undefined, height: number | undefined) => {
                const itemData: ItemValidationData = {
                    itemType,
                    productId,
                    quantity,
                    width,
                    height
                };

                const result = validationService.validateByType(itemData);

                // Para tipos dimensionais, width e height são obrigatórios e devem ser > 0
                const shouldHaveWidthError = !width || width <= 0;
                const shouldHaveHeightError = !height || height <= 0;

                if (shouldHaveWidthError || shouldHaveHeightError) {
                    expect(result.isValid).toBe(false);

                    if (shouldHaveWidthError) {
                        expect(result.errors.some(error =>
                            error.field === 'width' && error.code === 'REQUIRED_DIMENSION'
                        )).toBe(true);
                    }

                    if (shouldHaveHeightError) {
                        expect(result.errors.some(error =>
                            error.field === 'height' && error.code === 'REQUIRED_DIMENSION'
                        )).toBe(true);
                    }
                } else {
                    // Se width e height são válidos, não deve haver erros dimensionais
                    expect(result.errors.filter(error =>
                        error.field === 'width' || error.field === 'height'
                    )).toHaveLength(0);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Valid dimensional values should pass validation
     * For any dimensional type with valid width and height (> 0),
     * the dimensional validation should pass
     */
    test('should pass validation for dimensional types with valid dimensions', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(0.1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(0.1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            (itemType: ItemType, productId: string, quantity: number, width: number, height: number) => {
                const itemData: ItemValidationData = {
                    itemType,
                    productId,
                    quantity,
                    width,
                    height
                };

                const result = validationService.validateByType(itemData);

                // Não deve haver erros dimensionais para valores válidos
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Zero and negative dimensions should fail
     * For any dimensional type with zero or negative width/height,
     * validation should fail with appropriate error
     */
    test('should reject zero and negative dimensions for dimensional types', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) })
            ),
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) })
            ),
            (itemType: ItemType, productId: string, quantity: number, width: number, height: number) => {
                const itemData: ItemValidationData = {
                    itemType,
                    productId,
                    quantity,
                    width,
                    height
                };

                const result = validationService.validateByType(itemData);

                // Deve falhar para dimensões zero ou negativas
                expect(result.isValid).toBe(false);

                // Deve ter erros para width e height
                expect(result.errors.some(error =>
                    error.field === 'width' && error.code === 'REQUIRED_DIMENSION'
                )).toBe(true);

                expect(result.errors.some(error =>
                    error.field === 'height' && error.code === 'REQUIRED_DIMENSION'
                )).toBe(true);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Missing dimensions should fail for dimensional types
     * For any dimensional type without width or height,
     * validation should fail with required field error
     */
    test('should reject missing dimensions for dimensional types', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.boolean(), // whether to include width
            fc.boolean(), // whether to include height
            (itemType: ItemType, productId: string, quantity: number, includeWidth: boolean, includeHeight: boolean) => {
                // Skip case where both dimensions are provided (covered by other tests)
                if (includeWidth && includeHeight) {
                    return true;
                }

                const itemData: ItemValidationData = {
                    itemType,
                    productId,
                    quantity,
                    width: includeWidth ? 100 : undefined,
                    height: includeHeight ? 100 : undefined
                };

                const result = validationService.validateByType(itemData);

                // Deve falhar quando dimensões estão faltando
                expect(result.isValid).toBe(false);

                if (!includeWidth) {
                    expect(result.errors.some(error =>
                        error.field === 'width' && error.code === 'REQUIRED_DIMENSION'
                    )).toBe(true);
                }

                if (!includeHeight) {
                    expect(result.errors.some(error =>
                        error.field === 'height' && error.code === 'REQUIRED_DIMENSION'
                    )).toBe(true);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area calculation accuracy
     * For any valid width and height values, the calculated area
     * should equal (width × height) / 1,000,000 in square meters
     */
    test('should calculate area accurately from dimensions', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
            (width: number, height: number) => {
                const calculatedArea = validationService.calculateArea(width, height);
                const expectedArea = (width * height) / 1_000_000;

                // Usar tolerância para comparação de floats
                const tolerance = 0.000001;
                expect(Math.abs(calculatedArea - expectedArea)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area calculation
     * For any valid area and quantity, the total area should equal area × quantity
     */
    test('should calculate total area correctly', () => {
        fc.assert(fc.property(
            fc.float({ min: Math.fround(0.001), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.integer({ min: 1, max: 1000 }),
            (area: number, quantity: number) => {
                const totalArea = validationService.calculateTotalArea(area, quantity);
                const expectedTotalArea = area * quantity;

                // Usar tolerância para comparação de floats
                const tolerance = 0.000001;
                expect(Math.abs(totalArea - expectedTotalArea)).toBeLessThan(tolerance);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Area calculation should reject invalid inputs
     * For any zero or negative width/height, area calculation should throw error
     */
    test('should reject invalid dimensions for area calculation', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) })
            ),
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) })
            ),
            (width: number, height: number) => {
                expect(() => {
                    validationService.calculateArea(width, height);
                }).toThrow('Width and height must be greater than zero');

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Total area calculation should reject invalid inputs
     * For any zero or negative area/quantity, total area calculation should throw error
     */
    test('should reject invalid values for total area calculation', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(0),
                fc.float({ min: Math.fround(-100), max: Math.fround(-0.1) })
            ),
            fc.oneof(
                fc.constant(0),
                fc.integer({ min: -1000, max: -1 })
            ),
            (area: number, quantity: number) => {
                expect(() => {
                    validationService.calculateTotalArea(area, quantity);
                }).toThrow('Area and quantity must be greater than zero');

                return true;
            }
        ), { numRuns: 100 });
    });
});
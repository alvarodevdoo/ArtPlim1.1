/**
 * Property-Based Tests for Service Type Dimension Exemption
 * Feature: tipos-produtos, Property 4: Service Type Dimension Exemption
 * Validates: Requirements 7.1
 */

import fc from 'fast-check';
import { ItemValidationService, ItemValidationData } from '../../modules/sales/application/services/ItemValidationService';
import { ItemType } from '@prisma/client';

describe('Service Type Dimension Exemption Properties', () => {
    let validationService: ItemValidationService;

    beforeEach(() => {
        validationService = new ItemValidationService();
    });

    /**
     * Property 4: Service Type Dimension Exemption
     * For any item with type SERVICE, width and height fields should not be required 
     * and can be null/undefined without causing validation errors
     */
    test('should not require dimensions for SERVICE type', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            (productId: string, quantity: number, width: number | undefined, height: number | undefined) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width,
                    height
                };

                const result = validationService.validateByType(itemData);

                // SERVICE não deve ter erros dimensionais, independente dos valores de width/height
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                // Se houver outros erros, devem ser relacionados a outros campos (não dimensões)
                if (!result.isValid) {
                    result.errors.forEach(error => {
                        expect(error.field).not.toBe('width');
                        expect(error.field).not.toBe('height');
                        expect(error.code).not.toBe('REQUIRED_DIMENSION');
                    });
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: SERVICE with null dimensions should be valid
     * For any SERVICE item with null/undefined width and height,
     * the validation should pass (no dimensional errors)
     */
    test('should accept null dimensions for SERVICE type', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            (productId: string, quantity: number) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width: undefined,
                    height: undefined
                };

                const result = validationService.validateByType(itemData);

                // Não deve haver erros dimensionais
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: SERVICE with zero dimensions should not fail on dimensions
     * For any SERVICE item with zero width/height,
     * there should be no dimensional validation errors
     */
    test('should not reject zero dimensions for SERVICE type', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            (productId: string, quantity: number) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width: 0,
                    height: 0
                };

                const result = validationService.validateByType(itemData);

                // Não deve haver erros dimensionais para SERVICE, mesmo com dimensões zero
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: SERVICE with negative dimensions should not fail on dimensions
     * For any SERVICE item with negative width/height,
     * there should be no dimensional validation errors
     */
    test('should not reject negative dimensions for SERVICE type', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) }),
            fc.float({ min: Math.fround(-1000), max: Math.fround(-0.1) }),
            (productId: string, quantity: number, width: number, height: number) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width,
                    height
                };

                const result = validationService.validateByType(itemData);

                // Não deve haver erros dimensionais para SERVICE, mesmo com dimensões negativas
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: SERVICE validation should focus on attributes, not dimensions
     * For any SERVICE item with valid basic fields but invalid dimensions,
     * validation should only fail on non-dimensional issues
     */
    test('should validate SERVICE based on attributes not dimensions', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            fc.option(fc.record({
                description: fc.option(fc.string(), { nil: undefined }),
                briefing: fc.option(fc.string(), { nil: undefined }),
                estimatedHours: fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000) }), { nil: undefined })
            }), { nil: undefined }),
            (productId: string, quantity: number, width: number | undefined, height: number | undefined, attributes: any) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width,
                    height,
                    attributes
                };

                const result = validationService.validateByType(itemData);

                // Nunca deve haver erros dimensionais para SERVICE
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                // Se houver erros, devem ser relacionados a atributos ou campos básicos
                if (!result.isValid) {
                    result.errors.forEach(error => {
                        expect(['width', 'height']).not.toContain(error.field);
                        expect(error.code).not.toBe('REQUIRED_DIMENSION');
                    });
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: SERVICE with valid attributes should pass validation regardless of dimensions
     * For any SERVICE item with valid attributes and any dimension values,
     * validation should pass or fail based only on non-dimensional criteria
     */
    test('should validate SERVICE with valid attributes regardless of dimensions', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            fc.option(fc.float({ min: Math.fround(-1000), max: Math.fround(5000) }), { nil: undefined }),
            (productId: string, quantity: number, width: number | undefined, height: number | undefined) => {
                // Criar atributos válidos para SERVICE
                const validAttributes = {
                    description: 'Valid service description',
                    briefing: 'Optional briefing',
                    estimatedHours: 5,
                    skillLevel: 'intermediate'
                };

                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    width,
                    height,
                    attributes: validAttributes
                };

                const result = validationService.validateByType(itemData);

                // Não deve haver erros dimensionais
                const dimensionalErrors = result.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );

                expect(dimensionalErrors).toHaveLength(0);

                // Com atributos válidos, não deve haver erros de atributos SERVICE
                const serviceAttributeErrors = result.errors.filter(error =>
                    error.field.startsWith('attributes.') && error.code.includes('SERVICE')
                );

                expect(serviceAttributeErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Comparison with dimensional types
     * For the same data, SERVICE should not have dimensional errors while
     * dimensional types (PRINT_SHEET, PRINT_ROLL, LASER_CUT) should have them
     */
    test('should behave differently from dimensional types regarding dimensions', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            (productId: string, quantity: number) => {
                // Dados sem dimensões
                const baseData = {
                    productId,
                    quantity,
                    width: undefined,
                    height: undefined
                };

                // Testar SERVICE
                const serviceResult = validationService.validateByType({
                    ...baseData,
                    itemType: ItemType.SERVICE
                });

                // Testar tipo dimensional
                const printSheetResult = validationService.validateByType({
                    ...baseData,
                    itemType: ItemType.PRINT_SHEET
                });

                // SERVICE não deve ter erros dimensionais
                const serviceDimensionalErrors = serviceResult.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );
                expect(serviceDimensionalErrors).toHaveLength(0);

                // PRINT_SHEET deve ter erros dimensionais
                const printSheetDimensionalErrors = printSheetResult.errors.filter(error =>
                    error.field === 'width' || error.field === 'height'
                );
                expect(printSheetDimensionalErrors.length).toBeGreaterThan(0);

                return true;
            }
        ), { numRuns: 100 });
    });
});
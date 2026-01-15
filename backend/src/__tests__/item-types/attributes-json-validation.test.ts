/**
 * Property-Based Tests for Attributes JSON Structure Validation
 * Feature: tipos-produtos, Property 7: Attributes JSON Structure Validation
 * Validates: Requirements 2.4, 2.5, 10.4
 */

import fc from 'fast-check';
import { ItemValidationService, ItemValidationData } from '../../modules/sales/application/services/ItemValidationService';
import { ItemType } from '@prisma/client';

describe('Attributes JSON Structure Validation Properties', () => {
    let validationService: ItemValidationService;

    beforeEach(() => {
        validationService = new ItemValidationService();
    });

    /**
     * Property 7: Attributes JSON Structure Validation
     * For any item type, the attributes JSON should conform to the 
     * predefined schema for that specific type
     */
    test('should validate SERVICE attributes structure', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.record({
                description: fc.option(fc.string(), { nil: undefined }),
                briefing: fc.option(fc.string(), { nil: undefined }),
                estimatedHours: fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000) }), { nil: undefined }),
                skillLevel: fc.option(fc.oneof(
                    fc.constant('basic'),
                    fc.constant('intermediate'),
                    fc.constant('advanced'),
                    fc.string() // Invalid values
                ), { nil: undefined })
            }),
            (productId: string, quantity: number, attributes: any) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    attributes
                };

                const result = validationService.validateByType(itemData);

                // Verificar se description é obrigatório
                if (!attributes.description || typeof attributes.description !== 'string' || attributes.description.trim().length === 0) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.description' && error.code === 'REQUIRED_SERVICE_FIELD'
                    )).toBe(true);
                }

                // Verificar skillLevel se fornecido
                if (attributes.skillLevel && !['basic', 'intermediate', 'advanced'].includes(attributes.skillLevel)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.skillLevel' && error.code === 'INVALID_ENUM_VALUE'
                    )).toBe(true);
                }

                // Verificar estimatedHours se fornecido
                if (attributes.estimatedHours !== undefined && (typeof attributes.estimatedHours !== 'number' || attributes.estimatedHours <= 0)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.estimatedHours' && error.code === 'INVALID_NUMBER_VALUE'
                    )).toBe(true);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: PRINT_SHEET attributes validation
     * For any PRINT_SHEET item, attributes should follow the correct schema
     */
    test('should validate PRINT_SHEET attributes structure', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.record({
                paperSize: fc.option(fc.string(), { nil: undefined }),
                paperType: fc.option(fc.string(), { nil: undefined }),
                printColors: fc.option(fc.string(), { nil: undefined }),
                finishing: fc.option(fc.string(), { nil: undefined }),
                sides: fc.option(fc.oneof(
                    fc.constant('front'),
                    fc.constant('both'),
                    fc.string() // Invalid values
                ), { nil: undefined })
            }),
            (productId: string, quantity: number, width: number, height: number, attributes: any) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.PRINT_SHEET,
                    productId,
                    quantity,
                    width,
                    height,
                    attributes
                };

                const result = validationService.validateByType(itemData);

                // Verificar campos obrigatórios
                const requiredFields = ['paperSize', 'paperType', 'printColors'];
                for (const field of requiredFields) {
                    if (!attributes[field] || typeof attributes[field] !== 'string' || attributes[field].trim().length === 0) {
                        expect(result.isValid).toBe(false);
                        expect(result.errors.some(error =>
                            error.field === `attributes.${field}` && error.code === 'REQUIRED_PRINT_SHEET_FIELD'
                        )).toBe(true);
                    }
                }

                // Verificar sides se fornecido
                if (attributes.sides && !['front', 'both'].includes(attributes.sides)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.sides' && error.code === 'INVALID_ENUM_VALUE'
                    )).toBe(true);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: PRINT_ROLL attributes validation
     * For any PRINT_ROLL item, attributes should follow the correct schema
     */
    test('should validate PRINT_ROLL attributes structure', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.record({
                material: fc.option(fc.string(), { nil: undefined }),
                finishes: fc.option(fc.oneof(
                    fc.array(fc.string()),
                    fc.string(), // Invalid - should be array
                    fc.integer() // Invalid - should be array
                ), { nil: undefined }),
                installationType: fc.option(fc.oneof(
                    fc.constant('indoor'),
                    fc.constant('outdoor'),
                    fc.string() // Invalid values
                ), { nil: undefined }),
                windResistance: fc.option(fc.oneof(
                    fc.boolean(),
                    fc.string(), // Invalid - should be boolean
                    fc.integer() // Invalid - should be boolean
                ), { nil: undefined })
            }),
            (productId: string, quantity: number, width: number, height: number, attributes: any) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.PRINT_ROLL,
                    productId,
                    quantity,
                    width,
                    height,
                    attributes
                };

                const result = validationService.validateByType(itemData);

                // Verificar material obrigatório
                if (!attributes.material || typeof attributes.material !== 'string' || attributes.material.trim().length === 0) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.material' && error.code === 'REQUIRED_PRINT_ROLL_FIELD'
                    )).toBe(true);
                }

                // Verificar finishes se fornecido (deve ser array)
                if (attributes.finishes !== undefined && !Array.isArray(attributes.finishes)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.finishes' && error.code === 'INVALID_ARRAY_VALUE'
                    )).toBe(true);
                }

                // Verificar installationType se fornecido
                if (attributes.installationType && !['indoor', 'outdoor'].includes(attributes.installationType)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.installationType' && error.code === 'INVALID_ENUM_VALUE'
                    )).toBe(true);
                }

                // Verificar windResistance se fornecido
                if (attributes.windResistance !== undefined && typeof attributes.windResistance !== 'boolean') {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.windResistance' && error.code === 'INVALID_BOOLEAN_VALUE'
                    )).toBe(true);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: LASER_CUT attributes validation
     * For any LASER_CUT item, attributes should follow the correct schema
     */
    test('should validate LASER_CUT attributes structure', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
            fc.record({
                material: fc.option(fc.string(), { nil: undefined }),
                machineTimeMinutes: fc.option(fc.float({ min: Math.fround(-100), max: Math.fround(1000) }), { nil: undefined }),
                vectorFile: fc.option(fc.string(), { nil: undefined }),
                cutType: fc.option(fc.oneof(
                    fc.constant('cut'),
                    fc.constant('engrave'),
                    fc.constant('both'),
                    fc.string() // Invalid values
                ), { nil: undefined }),
                thickness: fc.option(fc.float({ min: Math.fround(-10), max: Math.fround(100) }), { nil: undefined })
            }),
            (productId: string, quantity: number, width: number, height: number, attributes: any) => {
                const itemData: ItemValidationData = {
                    itemType: ItemType.LASER_CUT,
                    productId,
                    quantity,
                    width,
                    height,
                    attributes
                };

                const result = validationService.validateByType(itemData);

                // Verificar material obrigatório
                if (!attributes.material || typeof attributes.material !== 'string' || attributes.material.trim().length === 0) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.material' && error.code === 'REQUIRED_LASER_CUT_FIELD'
                    )).toBe(true);
                }

                // Verificar machineTimeMinutes se fornecido
                if (attributes.machineTimeMinutes !== undefined && (typeof attributes.machineTimeMinutes !== 'number' || attributes.machineTimeMinutes <= 0)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.machineTimeMinutes' && error.code === 'INVALID_NUMBER_VALUE'
                    )).toBe(true);
                }

                // Verificar cutType se fornecido
                if (attributes.cutType && !['cut', 'engrave', 'both'].includes(attributes.cutType)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.cutType' && error.code === 'INVALID_ENUM_VALUE'
                    )).toBe(true);
                }

                // Verificar thickness se fornecido
                if (attributes.thickness !== undefined && (typeof attributes.thickness !== 'number' || attributes.thickness <= 0)) {
                    expect(result.isValid).toBe(false);
                    expect(result.errors.some(error =>
                        error.field === 'attributes.thickness' && error.code === 'INVALID_NUMBER_VALUE'
                    )).toBe(true);
                }

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Invalid attributes structure should fail
     * For any item type with non-object attributes, validation should fail
     */
    test('should reject non-object attributes', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            fc.oneof(
                fc.string(),
                fc.integer(),
                fc.boolean()
                // Removido fc.constant(null) pois null é tratado como "sem atributos"
            ),
            (itemType: ItemType, productId: string, quantity: number, invalidAttributes: any) => {
                const itemData: ItemValidationData = {
                    itemType,
                    productId,
                    quantity,
                    width: itemType !== ItemType.SERVICE ? 100 : undefined,
                    height: itemType !== ItemType.SERVICE ? 100 : undefined,
                    attributes: invalidAttributes
                };

                const result = validationService.validateByType(itemData);

                // Deve falhar para atributos não-objeto
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error =>
                    error.field === 'attributes' && error.code === 'INVALID_ATTRIBUTES_STRUCTURE'
                )).toBe(true);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Valid attributes should pass validation
     * For any item type with correctly structured attributes, validation should pass
     */
    test('should accept valid attributes for each type', () => {
        fc.assert(fc.property(
            fc.uuid(),
            fc.integer({ min: 1, max: 1000 }),
            (productId: string, quantity: number) => {
                // Testar SERVICE com atributos válidos
                const serviceData: ItemValidationData = {
                    itemType: ItemType.SERVICE,
                    productId,
                    quantity,
                    attributes: {
                        description: 'Valid service description',
                        briefing: 'Optional briefing',
                        estimatedHours: 5,
                        skillLevel: 'intermediate'
                    }
                };

                const serviceResult = validationService.validateByType(serviceData);
                const serviceAttributeErrors = serviceResult.errors.filter(error =>
                    error.field.startsWith('attributes.')
                );
                expect(serviceAttributeErrors).toHaveLength(0);

                // Testar PRINT_SHEET com atributos válidos
                const printSheetData: ItemValidationData = {
                    itemType: ItemType.PRINT_SHEET,
                    productId,
                    quantity,
                    width: 210,
                    height: 297,
                    attributes: {
                        paperSize: 'A4',
                        paperType: 'Couché',
                        printColors: '4x0',
                        finishing: 'Laminação',
                        sides: 'front'
                    }
                };

                const printSheetResult = validationService.validateByType(printSheetData);
                const printSheetAttributeErrors = printSheetResult.errors.filter(error =>
                    error.field.startsWith('attributes.')
                );
                expect(printSheetAttributeErrors).toHaveLength(0);

                // Testar PRINT_ROLL com atributos válidos
                const printRollData: ItemValidationData = {
                    itemType: ItemType.PRINT_ROLL,
                    productId,
                    quantity,
                    width: 1000,
                    height: 2000,
                    attributes: {
                        material: 'Lona 440g',
                        finishes: ['Bainha', 'Ilhós'],
                        installationType: 'outdoor',
                        windResistance: true
                    }
                };

                const printRollResult = validationService.validateByType(printRollData);
                const printRollAttributeErrors = printRollResult.errors.filter(error =>
                    error.field.startsWith('attributes.')
                );
                expect(printRollAttributeErrors).toHaveLength(0);

                // Testar LASER_CUT com atributos válidos
                const laserCutData: ItemValidationData = {
                    itemType: ItemType.LASER_CUT,
                    productId,
                    quantity,
                    width: 500,
                    height: 300,
                    attributes: {
                        material: 'MDF 3mm',
                        machineTimeMinutes: 15,
                        vectorFile: 'design.dxf',
                        cutType: 'cut',
                        thickness: 3
                    }
                };

                const laserCutResult = validationService.validateByType(laserCutData);
                const laserCutAttributeErrors = laserCutResult.errors.filter(error =>
                    error.field.startsWith('attributes.')
                );
                expect(laserCutAttributeErrors).toHaveLength(0);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Schema consistency
     * For any item type, the getSchemaForType method should return consistent
     * validation requirements that match the actual validation behavior
     */
    test('should have consistent schema definitions', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT),
                fc.constant(ItemType.PRODUCT)
            ),
            (itemType: ItemType) => {
                const schema = validationService.getSchemaForType(itemType);

                expect(schema).toBeDefined();
                expect(schema).toHaveProperty('required');
                expect(schema).toHaveProperty('optional');
                expect(schema).toHaveProperty('dimensionsRequired');

                expect(Array.isArray(schema.required)).toBe(true);
                expect(Array.isArray(schema.optional)).toBe(true);
                expect(typeof schema.dimensionsRequired).toBe('boolean');

                // Verificar consistência com validação dimensional
                const dimensionalTypes: ItemType[] = [ItemType.PRINT_SHEET, ItemType.PRINT_ROLL, ItemType.LASER_CUT];
                if (dimensionalTypes.includes(itemType)) {
                    expect(schema.dimensionsRequired).toBe(true);
                } else {
                    expect(schema.dimensionsRequired).toBe(false);
                }

                return true;
            }
        ), { numRuns: 100 });
    });
});
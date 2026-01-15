import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';

/**
 * Property-based test for attributes data packing
 * 
 * This test validates that type-specific data is correctly packed into JSON attributes
 * and that the structure is valid for each ItemType.
 * 
 * Property 14: Attributes Data Packing
 * Validates: Requirements 6.5
 */

enum ItemType {
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
    PRINT_SHEET = 'PRINT_SHEET',
    PRINT_ROLL = 'PRINT_ROLL',
    LASER_CUT = 'LASER_CUT'
}

// Simulate the data packing logic from the frontend
function packAttributesData(itemType: ItemType, formData: Record<string, any>): Record<string, any> {
    const attributes: Record<string, any> = {};

    switch (itemType) {
        case ItemType.SERVICE:
            attributes.description = formData.serviceDescription || '';
            attributes.briefing = formData.serviceBriefing || '';
            attributes.estimatedHours = (typeof formData.estimatedHours === 'number' && !isNaN(formData.estimatedHours)) ? formData.estimatedHours : 0;
            break;

        case ItemType.PRINT_SHEET:
            attributes.paperSize = formData.selectedStandardSize || formData.paperSize || '';
            attributes.paperType = formData.selectedMaterial || formData.paperType || '';
            attributes.printColors = formData.printColors || '';
            attributes.finishing = formData.selectedFinishing || formData.finishing || '';
            if (formData.isCustomSize) {
                attributes.customSizeName = formData.customSizeName || '';
                attributes.isCustomSize = true;
            }
            break;

        case ItemType.PRINT_ROLL:
            attributes.material = formData.selectedMaterial || formData.rollMaterial || '';
            attributes.finishes = formData.selectedFinishing ? [formData.selectedFinishing] : (formData.rollFinishes || []);
            attributes.installationType = formData.installationType || '';
            break;

        case ItemType.LASER_CUT:
            attributes.material = formData.selectedMaterial || formData.laserMaterial || '';
            attributes.machineTime = (typeof formData.machineTime === 'number' && !isNaN(formData.machineTime)) ? formData.machineTime : 0;
            attributes.vectorFile = formData.vectorFile || '';
            attributes.cutType = formData.cutType || '';
            break;

        case ItemType.PRODUCT:
        default:
            // For PRODUCT type, store legacy fields for backward compatibility
            if (formData.pricingMode === 'DYNAMIC_ENGINEER') {
                attributes.machineTime = (typeof formData.machineTime === 'number' && !isNaN(formData.machineTime)) ? formData.machineTime : 0;
                attributes.setupTime = (typeof formData.setupTime === 'number' && !isNaN(formData.setupTime)) ? formData.setupTime : 0;
                attributes.complexity = formData.complexity || '';
            }
            break;
    }

    return attributes;
}

// Validate attributes structure
function validateAttributesStructure(itemType: ItemType, attributes: Record<string, any>): boolean {
    switch (itemType) {
        case ItemType.SERVICE:
            return typeof attributes.description === 'string' && attributes.description.trim().length > 0;

        case ItemType.PRINT_SHEET:
            return typeof attributes.printColors === 'string' && attributes.printColors.length > 0;

        case ItemType.PRINT_ROLL:
            return typeof attributes.material === 'string' && attributes.material.length > 0 &&
                typeof attributes.installationType === 'string' && attributes.installationType.length > 0;

        case ItemType.LASER_CUT:
            return typeof attributes.material === 'string' && attributes.material.length > 0 &&
                typeof attributes.cutType === 'string' && attributes.cutType.length > 0;

        case ItemType.PRODUCT:
        default:
            return true;
    }
}

describe('Attributes Data Packing', () => {
    it('should pack SERVICE attributes correctly', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                fc.string({ maxLength: 500 }),
                fc.integer({ min: 0, max: 100 }),
                (description: string, briefing: string, hours: number) => {
                    const formData = {
                        serviceDescription: description,
                        serviceBriefing: briefing,
                        estimatedHours: hours
                    };

                    const attributes = packAttributesData(ItemType.SERVICE, formData);

                    expect(attributes.description).toBe(description);
                    expect(attributes.briefing).toBe(briefing);
                    expect(attributes.estimatedHours).toBe(hours);

                    // Should be valid structure
                    expect(validateAttributesStructure(ItemType.SERVICE, attributes)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should pack PRINT_SHEET attributes correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('A4', 'A3', 'CARTA', 'CUSTOM'),
                fc.constantFrom('SULFITE_75', 'COUCHE_115', 'CARTAO_250'),
                fc.constantFrom('1x0', '4x0', '4x4'),
                fc.constantFrom('NONE', 'LAMINACAO_FOSCA', 'VERNIZ_UV'),
                fc.boolean(),
                fc.string({ maxLength: 50 }),
                (paperSize: string, paperType: string, printColors: string, finishing: string, isCustom: boolean, customName: string) => {
                    const formData = {
                        selectedStandardSize: paperSize === 'CUSTOM' ? '' : paperSize,
                        selectedMaterial: paperType,
                        printColors,
                        selectedFinishing: finishing,
                        isCustomSize: isCustom && paperSize === 'CUSTOM',
                        customSizeName: isCustom ? customName : ''
                    };

                    const attributes = packAttributesData(ItemType.PRINT_SHEET, formData);

                    expect(attributes.paperSize).toBe(paperSize === 'CUSTOM' ? '' : paperSize);
                    expect(attributes.paperType).toBe(paperType);
                    expect(attributes.printColors).toBe(printColors);
                    expect(attributes.finishing).toBe(finishing);

                    if (isCustom && paperSize === 'CUSTOM') {
                        expect(attributes.isCustomSize).toBe(true);
                        expect(attributes.customSizeName).toBe(customName);
                    }

                    // Should be valid structure
                    expect(validateAttributesStructure(ItemType.PRINT_SHEET, attributes)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should pack PRINT_ROLL attributes correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('LONA_440', 'VINIL_80', 'MESH_270'),
                fc.constantFrom('BAINHA', 'ILHOS', 'BASTAO'),
                fc.constantFrom('PAREDE', 'FACHADA', 'CAVALETE', 'SUSPENSO'),
                (material: string, finishing: string, installation: string) => {
                    const formData = {
                        selectedMaterial: material,
                        selectedFinishing: finishing,
                        installationType: installation
                    };

                    const attributes = packAttributesData(ItemType.PRINT_ROLL, formData);

                    expect(attributes.material).toBe(material);
                    expect(attributes.finishes).toEqual([finishing]);
                    expect(attributes.installationType).toBe(installation);

                    // Should be valid structure
                    expect(validateAttributesStructure(ItemType.PRINT_ROLL, attributes)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should pack LASER_CUT attributes correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('MDF_3MM', 'ACRILICO_3MM', 'COMPENSADO_3MM'),
                fc.integer({ min: 0, max: 120 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.constantFrom('CORTE', 'GRAVACAO', 'CORTE_GRAVACAO'),
                (material: string, machineTime: number, vectorFile: string, cutType: string) => {
                    const formData = {
                        selectedMaterial: material,
                        machineTime,
                        vectorFile,
                        cutType
                    };

                    const attributes = packAttributesData(ItemType.LASER_CUT, formData);

                    expect(attributes.material).toBe(material);
                    expect(attributes.machineTime).toBe(machineTime);
                    expect(attributes.vectorFile).toBe(vectorFile);
                    expect(attributes.cutType).toBe(cutType);

                    // Should be valid structure
                    expect(validateAttributesStructure(ItemType.LASER_CUT, attributes)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should pack PRODUCT attributes correctly for dynamic pricing', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 60 }),
                fc.integer({ min: 0, max: 30 }),
                fc.constantFrom('SIMPLES', 'MEDIO', 'COMPLEXO', 'MUITO_COMPLEXO'),
                (machineTime: number, setupTime: number, complexity: string) => {
                    const formData = {
                        pricingMode: 'DYNAMIC_ENGINEER',
                        machineTime,
                        setupTime,
                        complexity
                    };

                    const attributes = packAttributesData(ItemType.PRODUCT, formData);

                    expect(attributes.machineTime).toBe(machineTime);
                    expect(attributes.setupTime).toBe(setupTime);
                    expect(attributes.complexity).toBe(complexity);

                    // Should be valid structure
                    expect(validateAttributesStructure(ItemType.PRODUCT, attributes)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle empty or invalid form data gracefully', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const emptyFormData = {};
                    const attributes = packAttributesData(itemType, emptyFormData);

                    // Should not throw errors
                    expect(typeof attributes).toBe('object');
                    expect(attributes).not.toBeNull();

                    // Validation should handle empty data appropriately
                    const isValid = validateAttributesStructure(itemType, attributes);

                    // SERVICE, PRINT_SHEET, PRINT_ROLL, LASER_CUT should be invalid with empty data
                    // PRODUCT should be valid (legacy compatibility)
                    if (itemType === ItemType.PRODUCT) {
                        expect(isValid).toBe(true);
                    } else {
                        expect(isValid).toBe(false);
                    }

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should preserve data types correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const formData = {
                        // String fields
                        serviceDescription: 'Test Service',
                        serviceBriefing: 'Test Briefing',
                        selectedMaterial: 'TEST_MATERIAL',
                        vectorFile: 'test.svg',
                        cutType: 'CORTE',
                        installationType: 'PAREDE',

                        // Number fields
                        estimatedHours: 5,
                        machineTime: 10,
                        setupTime: 2,

                        // Boolean fields
                        isCustomSize: true,

                        // Array fields
                        rollFinishes: ['BAINHA', 'ILHOS']
                    };

                    const attributes = packAttributesData(itemType, formData);

                    // Check that data types are preserved
                    Object.entries(attributes).forEach(([key, value]) => {
                        if (key === 'estimatedHours' || key === 'machineTime' || key === 'setupTime') {
                            expect(typeof value).toBe('number');
                        } else if (key === 'isCustomSize') {
                            expect(typeof value).toBe('boolean');
                        } else if (key === 'finishes') {
                            expect(Array.isArray(value)).toBe(true);
                        } else {
                            expect(typeof value).toBe('string');
                        }
                    });

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should handle JSON serialization correctly', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const formData = {
                        serviceDescription: 'Test "quoted" string with special chars: àáâã',
                        serviceBriefing: 'Multi\nline\ntext',
                        selectedMaterial: 'Material with spaces',
                        rollFinishes: ['Finish 1', 'Finish 2'],
                        estimatedHours: 3,
                        isCustomSize: true
                    };

                    const attributes = packAttributesData(itemType, formData);

                    // Should be JSON serializable
                    let jsonString: string;
                    expect(() => {
                        jsonString = JSON.stringify(attributes);
                    }).not.toThrow();

                    // Should be JSON deserializable
                    let parsedAttributes: any;
                    expect(() => {
                        parsedAttributes = JSON.parse(jsonString!);
                    }).not.toThrow();

                    // Should preserve data after round-trip
                    expect(parsedAttributes).toEqual(attributes);

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should validate required fields for each type', () => {
        const requiredFieldsByType = {
            [ItemType.SERVICE]: ['description'],
            [ItemType.PRINT_SHEET]: ['printColors'],
            [ItemType.PRINT_ROLL]: ['material', 'installationType'],
            [ItemType.LASER_CUT]: ['material', 'cutType'],
            [ItemType.PRODUCT]: [] // No required fields for backward compatibility
        };

        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const requiredFields = requiredFieldsByType[itemType];

                    // Test with all required fields present
                    const completeFormData: Record<string, any> = {
                        serviceDescription: 'Test Service',
                        printColors: '4x4',
                        selectedMaterial: 'TEST_MATERIAL',
                        installationType: 'PAREDE',
                        cutType: 'CORTE'
                    };

                    const completeAttributes = packAttributesData(itemType, completeFormData);
                    expect(validateAttributesStructure(itemType, completeAttributes)).toBe(true);

                    // Test with missing required fields (except PRODUCT)
                    if (requiredFields.length > 0) {
                        const incompleteAttributes = packAttributesData(itemType, {});
                        expect(validateAttributesStructure(itemType, incompleteAttributes)).toBe(false);
                    }

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });
});
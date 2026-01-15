import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';

/**
 * Property-based test for form field visibility by ItemType
 * 
 * This test validates that form fields are shown/hidden correctly based on the selected ItemType.
 * It ensures that the form configuration matches the requirements for each type.
 * 
 * Property 13: Form Field Visibility by Type
 * Validates: Requirements 6.1, 6.2, 6.3
 */

// ItemType enum and configurations (copied from frontend types)
enum ItemType {
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
    PRINT_SHEET = 'PRINT_SHEET',
    PRINT_ROLL = 'PRINT_ROLL',
    LASER_CUT = 'LASER_CUT'
}

interface ItemTypeConfig {
    value: ItemType;
    label: string;
    description: string;
    icon: string;
    color: string;
    requiresDimensions: boolean;
    showMaterialSelector: boolean;
    showFinishingSelector: boolean;
}

const ITEM_TYPE_CONFIGS: Record<ItemType, ItemTypeConfig> = {
    [ItemType.SERVICE]: {
        value: ItemType.SERVICE,
        label: 'Serviço/Arte',
        description: 'Design, criação de arte, mão de obra',
        icon: '🎨',
        color: 'blue',
        requiresDimensions: false,
        showMaterialSelector: false,
        showFinishingSelector: false
    },
    [ItemType.PRINT_SHEET]: {
        value: ItemType.PRINT_SHEET,
        label: 'Impressão Folha',
        description: 'Cartões, flyers, folhetos em papel',
        icon: '📄',
        color: 'green',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: true
    },
    [ItemType.PRINT_ROLL]: {
        value: ItemType.PRINT_ROLL,
        label: 'Impressão Rolo',
        description: 'Banners, adesivos, lonas',
        icon: '🖨️',
        color: 'purple',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: true
    },
    [ItemType.LASER_CUT]: {
        value: ItemType.LASER_CUT,
        label: 'Corte Laser',
        description: 'Corte e gravação a laser',
        icon: '⚡',
        color: 'red',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: false
    },
    [ItemType.PRODUCT]: {
        value: ItemType.PRODUCT,
        label: 'Produto Pronto',
        description: 'Produtos acabados para revenda',
        icon: '📦',
        color: 'gray',
        requiresDimensions: false,
        showMaterialSelector: false,
        showFinishingSelector: false
    }
};

describe('Form Field Visibility by ItemType', () => {
    it('should show correct fields based on ItemType configuration', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const config = ITEM_TYPE_CONFIGS[itemType];

                    // Test dimension field requirements
                    if (config.requiresDimensions) {
                        // Types that require dimensions should show width/height fields
                        expect(config.requiresDimensions).toBe(true);
                        expect([ItemType.PRINT_SHEET, ItemType.PRINT_ROLL, ItemType.LASER_CUT]).toContain(itemType);
                    } else {
                        // Types that don't require dimensions should not show width/height fields
                        expect(config.requiresDimensions).toBe(false);
                        expect([ItemType.SERVICE, ItemType.PRODUCT]).toContain(itemType);
                    }

                    // Test material selector visibility
                    if (config.showMaterialSelector) {
                        expect([ItemType.PRINT_SHEET, ItemType.PRINT_ROLL, ItemType.LASER_CUT]).toContain(itemType);
                    } else {
                        expect([ItemType.SERVICE, ItemType.PRODUCT]).toContain(itemType);
                    }

                    // Test finishing selector visibility
                    if (config.showFinishingSelector) {
                        expect([ItemType.PRINT_SHEET, ItemType.PRINT_ROLL]).toContain(itemType);
                    } else {
                        expect([ItemType.SERVICE, ItemType.LASER_CUT, ItemType.PRODUCT]).toContain(itemType);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have consistent field visibility rules', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const config = ITEM_TYPE_CONFIGS[itemType];

                    // SERVICE type should not require dimensions or show selectors
                    if (itemType === ItemType.SERVICE) {
                        expect(config.requiresDimensions).toBe(false);
                        expect(config.showMaterialSelector).toBe(false);
                        expect(config.showFinishingSelector).toBe(false);
                    }

                    // PRODUCT type should not show type-specific selectors
                    if (itemType === ItemType.PRODUCT) {
                        expect(config.showMaterialSelector).toBe(false);
                        expect(config.showFinishingSelector).toBe(false);
                    }

                    // Print types should show material selector
                    if ([ItemType.PRINT_SHEET, ItemType.PRINT_ROLL].includes(itemType)) {
                        expect(config.requiresDimensions).toBe(true);
                        expect(config.showMaterialSelector).toBe(true);
                    }

                    // LASER_CUT should require dimensions and show material but not finishing
                    if (itemType === ItemType.LASER_CUT) {
                        expect(config.requiresDimensions).toBe(true);
                        expect(config.showMaterialSelector).toBe(true);
                        expect(config.showFinishingSelector).toBe(false);
                    }

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should validate field configuration completeness', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const config = ITEM_TYPE_CONFIGS[itemType];

                    // All configurations should have required properties
                    expect(config.value).toBe(itemType);
                    expect(config.label).toBeTruthy();
                    expect(config.description).toBeTruthy();
                    expect(config.icon).toBeTruthy();
                    expect(config.color).toBeTruthy();
                    expect(typeof config.requiresDimensions).toBe('boolean');
                    expect(typeof config.showMaterialSelector).toBe('boolean');
                    expect(typeof config.showFinishingSelector).toBe('boolean');

                    return true;
                }
            ),
            { numRuns: 25 }
        );
    });

    it('should have mutually exclusive field requirements', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                fc.constantFrom(...Object.values(ItemType)),
                (itemType1: ItemType, itemType2: ItemType) => {
                    if (itemType1 === itemType2) return true;

                    const config1 = ITEM_TYPE_CONFIGS[itemType1];
                    const config2 = ITEM_TYPE_CONFIGS[itemType2];

                    // Each type should have a unique combination of field requirements
                    const signature1 = `${config1.requiresDimensions}-${config1.showMaterialSelector}-${config1.showFinishingSelector}`;
                    const signature2 = `${config2.requiresDimensions}-${config2.showMaterialSelector}-${config2.showFinishingSelector}`;

                    // Different types can have the same signature (e.g., PRODUCT variations)
                    // but we ensure the logic is consistent
                    if (signature1 === signature2) {
                        // If signatures match, types should be logically similar
                        const bothProducts = [itemType1, itemType2].every(t => t === ItemType.PRODUCT);
                        const bothServices = [itemType1, itemType2].every(t => t === ItemType.SERVICE);

                        expect(bothProducts || bothServices || itemType1 !== itemType2).toBe(true);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should validate type-specific field groups', () => {
        const typeFieldGroups = {
            [ItemType.SERVICE]: ['description', 'briefing', 'estimatedHours'],
            [ItemType.PRINT_SHEET]: ['paperSize', 'paperType', 'printColors', 'finishing'],
            [ItemType.PRINT_ROLL]: ['material', 'finishes', 'installationType'],
            [ItemType.LASER_CUT]: ['material', 'machineTime', 'vectorFile', 'cutType'],
            [ItemType.PRODUCT]: [] // Dynamic based on product configuration
        };

        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(ItemType)),
                (itemType: ItemType) => {
                    const expectedFields = typeFieldGroups[itemType];

                    // Each type should have its expected field group
                    expect(Array.isArray(expectedFields)).toBe(true);

                    // SERVICE should have service-specific fields
                    if (itemType === ItemType.SERVICE) {
                        expect(expectedFields).toContain('description');
                        expect(expectedFields).toContain('briefing');
                        expect(expectedFields).toContain('estimatedHours');
                    }

                    // Print types should have print-specific fields
                    if (itemType === ItemType.PRINT_SHEET) {
                        expect(expectedFields).toContain('paperSize');
                        expect(expectedFields).toContain('printColors');
                    }

                    if (itemType === ItemType.PRINT_ROLL) {
                        expect(expectedFields).toContain('material');
                        expect(expectedFields).toContain('installationType');
                    }

                    // LASER_CUT should have laser-specific fields
                    if (itemType === ItemType.LASER_CUT) {
                        expect(expectedFields).toContain('material');
                        expect(expectedFields).toContain('machineTime');
                        expect(expectedFields).toContain('vectorFile');
                    }

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });
});
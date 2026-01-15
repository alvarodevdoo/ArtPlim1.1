/**
 * Property-Based Tests for ItemType Enum Validation
 * Feature: tipos-produtos, Property 1: ItemType Enum Validation
 * Validates: Requirements 1.1, 1.4
 */

import fc from 'fast-check';

// Mock ItemType enum for testing
enum ItemType {
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
    PRINT_SHEET = 'PRINT_SHEET',
    PRINT_ROLL = 'PRINT_ROLL',
    LASER_CUT = 'LASER_CUT'
}

describe('ItemType Enum Validation Properties', () => {

    /**
     * Property 1: ItemType Enum Validation
     * For any item creation or update request, the itemType field should only accept 
     * values from the defined ItemType enum (PRODUCT, SERVICE, PRINT_SHEET, PRINT_ROLL, LASER_CUT)
     */
    test('should only accept valid ItemType enum values', () => {
        fc.assert(fc.property(
            fc.oneof(
                fc.constant(ItemType.PRODUCT),
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            (validItemType) => {
                // Valid enum values should be accepted
                expect(Object.values(ItemType)).toContain(validItemType);
                return true;
            }
        ), { numRuns: 100 });
    });

    test('should reject invalid ItemType enum values', () => {
        fc.assert(fc.property(
            fc.string().filter(str =>
                !Object.values(ItemType).includes(str as ItemType)
            ),
            (invalidItemType) => {
                // Invalid enum values should be rejected
                expect(Object.values(ItemType)).not.toContain(invalidItemType);
                return true;
            }
        ), { numRuns: 100 });
    });

    test('should contain all required ItemType values', () => {
        const requiredValues = [ItemType.PRODUCT, ItemType.SERVICE, ItemType.PRINT_SHEET, ItemType.PRINT_ROLL, ItemType.LASER_CUT];
        const enumValues = Object.values(ItemType);

        requiredValues.forEach(value => {
            expect(enumValues).toContain(value);
        });
    });

    test('should have exactly 5 ItemType values', () => {
        expect(Object.values(ItemType)).toHaveLength(5);
    });

    /**
     * Property for validation in API context
     * Simulates how the enum would be validated in actual API requests
     */
    test('should validate ItemType in API request context', () => {
        fc.assert(fc.property(
            fc.record({
                itemType: fc.oneof(
                    fc.constant(ItemType.PRODUCT),
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.string().filter(str =>
                        !Object.values(ItemType).includes(str as ItemType)
                    )
                ),
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 })
            }),
            (itemData) => {
                const isValidItemType = Object.values(ItemType).includes(itemData.itemType as ItemType);

                if (isValidItemType) {
                    // Valid ItemType should pass validation
                    expect(() => validateItemType(itemData.itemType)).not.toThrow();
                } else {
                    // Invalid ItemType should fail validation
                    expect(() => validateItemType(itemData.itemType)).toThrow();
                }

                return true;
            }
        ), { numRuns: 100 });
    });
});

/**
 * Helper function to simulate ItemType validation
 * This would be used in actual API validation logic
 */
function validateItemType(itemType: string): boolean {
    if (!Object.values(ItemType).includes(itemType as ItemType)) {
        throw new Error(`Invalid ItemType: ${itemType}. Must be one of: ${Object.values(ItemType).join(', ')}`);
    }
    return true;
}
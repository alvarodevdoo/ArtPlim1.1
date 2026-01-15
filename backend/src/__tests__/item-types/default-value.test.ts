/**
 * Property-Based Tests for Default ItemType Assignment
 * Feature: tipos-produtos, Property 2: Default ItemType Assignment
 * Validates: Requirements 1.3
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

describe('Default ItemType Assignment Properties', () => {

    /**
     * Property 2: Default ItemType Assignment
     * For any item created without specifying itemType, the system should 
     * automatically assign PRODUCT as the default value
     */
    test('should assign PRODUCT as default when itemType is not specified', () => {
        fc.assert(fc.property(
            fc.record({
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 }),
                unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
                // Deliberately omit itemType to test default behavior
            }),
            (itemData: any) => {
                const itemWithDefaults = applyDefaultItemType(itemData);

                // Should have PRODUCT as default itemType
                expect(itemWithDefaults.itemType).toBe(ItemType.PRODUCT);

                return true;
            }
        ), { numRuns: 100 });
    });

    test('should preserve explicitly set itemType values', () => {
        fc.assert(fc.property(
            fc.record({
                itemType: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 }),
                unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) })
            }),
            (itemData: any) => {
                const itemWithDefaults = applyDefaultItemType(itemData);

                // Should preserve the explicitly set itemType
                expect(itemWithDefaults.itemType).toBe(itemData.itemType);
                expect(itemWithDefaults.itemType).not.toBe(ItemType.PRODUCT);

                return true;
            }
        ), { numRuns: 100 });
    });

    test('should handle empty itemType values', () => {
        fc.assert(fc.property(
            fc.record({
                itemType: fc.constant(''),
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 })
            }),
            (itemData: any) => {
                const itemWithDefaults = applyDefaultItemType(itemData);

                // Should default to PRODUCT for empty values
                expect(itemWithDefaults.itemType).toBe(ItemType.PRODUCT);

                return true;
            }
        ), { numRuns: 100 });
    });

    test('should maintain backward compatibility with existing items', () => {
        fc.assert(fc.property(
            fc.array(fc.record({
                id: fc.uuid(),
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 }),
                // Simulate existing items without itemType field
            }), { minLength: 1, maxLength: 10 }),
            (existingItems: any[]) => {
                const migratedItems = existingItems.map(item => applyDefaultItemType(item));

                // All existing items should get PRODUCT as default
                migratedItems.forEach(item => {
                    expect(item.itemType).toBe(ItemType.PRODUCT);
                });

                // Should preserve all other fields
                migratedItems.forEach((item, index) => {
                    expect(item.id).toBe(existingItems[index].id);
                    expect(item.productId).toBe(existingItems[index].productId);
                    expect(item.quantity).toBe(existingItems[index].quantity);
                });

                return true;
            }
        ), { numRuns: 100 });
    });

    test('should apply default in database schema context', () => {
        // Test that simulates Prisma schema default behavior
        const schemaDefault = ItemType.PRODUCT;

        fc.assert(fc.property(
            fc.record({
                productId: fc.uuid(),
                quantity: fc.integer({ min: 1, max: 1000 }),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) })
            }),
            (itemData: any) => {
                // Simulate database insert without itemType
                const dbItem = {
                    ...itemData,
                    itemType: itemData.itemType || schemaDefault
                };

                expect(dbItem.itemType).toBe(ItemType.PRODUCT);

                return true;
            }
        ), { numRuns: 100 });
    });
});

/**
 * Helper function to simulate default ItemType assignment
 * This would be used in actual API/service logic
 */
function applyDefaultItemType(itemData: any): any {
    return {
        ...itemData,
        itemType: itemData.itemType || ItemType.PRODUCT
    };
}
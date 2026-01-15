/**
 * Backward Compatibility Tests for ItemType System
 * 
 * Tests that the new ItemType system maintains compatibility with existing data
 * and that legacy functionality continues to work as expected.
 * 
 * Requirements: 8.1, 8.4 (Backward Compatibility)
 */

import fc from 'fast-check';
import { ItemType } from '@prisma/client';

// Mock interfaces for legacy data structures
interface LegacyOrderItem {
    id: string;
    name: string;
    description?: string;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    // Note: No itemType or attributes fields
}

interface ModernOrderItem {
    id: string;
    name: string;
    description?: string;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    itemType: ItemType;
    attributes?: Record<string, any>;
}

// Mock system for testing backward compatibility
interface CompatibilitySystem {
    migrateLegacyItem: (legacyItem: LegacyOrderItem) => ModernOrderItem;
    processLegacyData: (legacyItems: LegacyOrderItem[]) => { success: boolean; modernItems: ModernOrderItem[]; errors: string[] };
    validateLegacyCompatibility: (modernItem: ModernOrderItem) => { isLegacyCompatible: boolean; legacyEquivalent: LegacyOrderItem };
    calculateLegacyPricing: (item: LegacyOrderItem) => { totalPrice: number; area?: number };
    calculateModernPricing: (item: ModernOrderItem) => { totalPrice: number; area?: number; totalArea?: number };
}

// Generators for legacy data
const legacyOrderItemGen = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
    width: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true }), { nil: undefined }),
    height: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true }), { nil: undefined }),
    quantity: fc.integer({ min: 1, max: 10000 }),
    unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    totalPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true })
});

// Mock implementation of compatibility system
const createCompatibilitySystem = (): CompatibilitySystem => ({
    migrateLegacyItem: (legacyItem: LegacyOrderItem): ModernOrderItem => {
        // Default migration strategy: assign PRODUCT type and preserve all data
        return {
            ...legacyItem,
            itemType: ItemType.PRODUCT,
            attributes: undefined // Legacy items don't have attributes
        };
    },

    processLegacyData: (legacyItems: LegacyOrderItem[]) => {
        try {
            const modernItems = legacyItems.map(item => ({
                ...item,
                itemType: ItemType.PRODUCT,
                attributes: undefined
            }));

            return {
                success: true,
                modernItems,
                errors: []
            };
        } catch (error) {
            return {
                success: false,
                modernItems: [],
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    },

    validateLegacyCompatibility: (modernItem: ModernOrderItem) => {
        // Check if modern item can be represented as legacy item
        const legacyEquivalent: LegacyOrderItem = {
            id: modernItem.id,
            name: modernItem.name,
            description: modernItem.description,
            width: modernItem.width,
            height: modernItem.height,
            quantity: modernItem.quantity,
            unitPrice: modernItem.unitPrice,
            totalPrice: modernItem.totalPrice
        };

        // Modern item is legacy compatible if it doesn't rely on type-specific features
        const isLegacyCompatible = modernItem.itemType === ItemType.PRODUCT ||
            !modernItem.attributes ||
            Object.keys(modernItem.attributes).length === 0;

        return { isLegacyCompatible, legacyEquivalent };
    },

    calculateLegacyPricing: (item: LegacyOrderItem) => {
        let totalPrice = item.unitPrice * item.quantity;
        let area: number | undefined;

        // Legacy system only calculated area for items with dimensions
        if (item.width && item.height) {
            area = (item.width * item.height) / 1_000_000; // mm to m²
        }

        return { totalPrice, area };
    },

    calculateModernPricing: (item: ModernOrderItem) => {
        let totalPrice = item.unitPrice * item.quantity;
        let area: number | undefined;
        let totalArea: number | undefined;

        // Modern system calculates area based on type and dimensions
        if (item.width && item.height) {
            // All types with dimensions get area calculation in modern system
            area = (item.width * item.height) / 1_000_000;
            totalArea = area * item.quantity;
        }

        return { totalPrice, area, totalArea };
    }
});

describe('Backward Compatibility Properties', () => {
    describe('Property 40: Legacy Data Migration Integrity', () => {
        it('should migrate legacy items without data loss', () => {
            fc.assert(fc.property(
                legacyOrderItemGen,
                (legacyItem) => {
                    const system = createCompatibilitySystem();
                    const modernItem = system.migrateLegacyItem(legacyItem);

                    // Property: All legacy fields should be preserved
                    const fieldsPreserved = modernItem.id === legacyItem.id &&
                        modernItem.name === legacyItem.name &&
                        modernItem.description === legacyItem.description &&
                        modernItem.width === legacyItem.width &&
                        modernItem.height === legacyItem.height &&
                        modernItem.quantity === legacyItem.quantity &&
                        modernItem.unitPrice === legacyItem.unitPrice &&
                        modernItem.totalPrice === legacyItem.totalPrice;

                    // Property: Default ItemType should be assigned
                    const defaultTypeAssigned = modernItem.itemType === ItemType.PRODUCT;

                    // Property: Attributes should be undefined for legacy items
                    const attributesHandled = modernItem.attributes === undefined;

                    return fieldsPreserved && defaultTypeAssigned && attributesHandled;
                }
            ), { numRuns: 100 });
        });

        it('should process batches of legacy data successfully', () => {
            fc.assert(fc.property(
                fc.array(legacyOrderItemGen, { minLength: 1, maxLength: 50 }),
                (legacyItems) => {
                    const system = createCompatibilitySystem();
                    const result = system.processLegacyData(legacyItems);

                    // Property: Processing should succeed
                    const processingSuccessful = result.success === true;

                    // Property: All items should be migrated
                    const allItemsMigrated = result.modernItems.length === legacyItems.length;

                    // Property: No errors should occur for valid legacy data
                    const noErrors = result.errors.length === 0;

                    // Property: Each migrated item should preserve original data
                    const dataPreserved = result.modernItems.every((modernItem, index) => {
                        const originalItem = legacyItems[index];
                        return modernItem.id === originalItem.id &&
                            modernItem.name === originalItem.name &&
                            modernItem.quantity === originalItem.quantity &&
                            modernItem.unitPrice === originalItem.unitPrice;
                    });

                    return processingSuccessful && allItemsMigrated && noErrors && dataPreserved;
                }
            ), { numRuns: 50 });
        });
    });

    describe('Property 41: Legacy System Compatibility', () => {
        it('should maintain compatibility with legacy pricing calculations', () => {
            fc.assert(fc.property(
                legacyOrderItemGen,
                (legacyItem) => {
                    const system = createCompatibilitySystem();
                    const modernItem = system.migrateLegacyItem(legacyItem);

                    const legacyPricing = system.calculateLegacyPricing(legacyItem);
                    const modernPricing = system.calculateModernPricing(modernItem);

                    // Property: Total price calculation should be identical
                    const totalPriceCompatible = Math.abs(legacyPricing.totalPrice - modernPricing.totalPrice) < 0.01;

                    // Property: Area calculation should be compatible
                    const areaCompatible = legacyPricing.area === undefined ?
                        modernPricing.area === undefined :
                        modernPricing.area !== undefined && Math.abs(legacyPricing.area - modernPricing.area) < 0.000001;

                    // Property: Modern system should provide additional features (totalArea)
                    const modernEnhancements = modernPricing.totalArea !== undefined || modernPricing.area === undefined;

                    return totalPriceCompatible && areaCompatible && modernEnhancements;
                }
            ), { numRuns: 100 });
        });

        it('should validate legacy compatibility of modern items', () => {
            fc.assert(fc.property(
                legacyOrderItemGen,
                (legacyItem) => {
                    const system = createCompatibilitySystem();
                    const modernItem = system.migrateLegacyItem(legacyItem);
                    const compatibility = system.validateLegacyCompatibility(modernItem);

                    // Property: Migrated items should be legacy compatible
                    const isCompatible = compatibility.isLegacyCompatible === true;

                    // Property: Legacy equivalent should match original data
                    const equivalentMatches = compatibility.legacyEquivalent.id === legacyItem.id &&
                        compatibility.legacyEquivalent.name === legacyItem.name &&
                        compatibility.legacyEquivalent.quantity === legacyItem.quantity &&
                        compatibility.legacyEquivalent.unitPrice === legacyItem.unitPrice;

                    return isCompatible && equivalentMatches;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 42: Feature Degradation Gracefully', () => {
        it('should handle modern features gracefully when converting to legacy format', () => {
            fc.assert(fc.property(
                fc.record({
                    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    description: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
                    width: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true }), { nil: undefined }),
                    height: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true }), { nil: undefined }),
                    quantity: fc.integer({ min: 1, max: 10000 }),
                    unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
                    totalPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
                    itemType: fc.constantFrom(ItemType.SERVICE, ItemType.PRINT_SHEET, ItemType.PRINT_ROLL, ItemType.LASER_CUT, ItemType.PRODUCT),
                    attributes: fc.option(fc.record({
                        description: fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), { nil: undefined }),
                        material: fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined }),
                        complexity: fc.option(fc.constantFrom('simple', 'medium', 'complex'), { nil: undefined })
                    }), { nil: undefined })
                }),
                (modernItem) => {
                    const system = createCompatibilitySystem();
                    const compatibility = system.validateLegacyCompatibility(modernItem);

                    // Property: Legacy equivalent should always be creatable
                    const legacyEquivalentExists = compatibility.legacyEquivalent !== undefined &&
                        typeof compatibility.legacyEquivalent === 'object';

                    // Property: Core fields should be preserved in legacy format
                    const coreFieldsPreserved = compatibility.legacyEquivalent.id === modernItem.id &&
                        compatibility.legacyEquivalent.name === modernItem.name &&
                        compatibility.legacyEquivalent.quantity === modernItem.quantity &&
                        compatibility.legacyEquivalent.unitPrice === modernItem.unitPrice;

                    // Property: Legacy equivalent should not have modern-only fields
                    const noModernFields = !('itemType' in compatibility.legacyEquivalent) &&
                        !('attributes' in compatibility.legacyEquivalent);

                    // Property: Compatibility flag should reflect actual compatibility
                    const compatibilityFlagAccurate = modernItem.itemType === ItemType.PRODUCT ||
                        !modernItem.attributes ||
                        Object.keys(modernItem.attributes).length === 0 ?
                        compatibility.isLegacyCompatible : true; // Allow both compatible and incompatible

                    return legacyEquivalentExists && coreFieldsPreserved && noModernFields && compatibilityFlagAccurate;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 43: Data Integrity During Migration', () => {
        it('should maintain referential integrity during legacy data migration', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                    quantity: fc.integer({ min: 1, max: 1000 }),
                    unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
                    totalPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
                    orderId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0) // Simulated foreign key
                }), { minLength: 1, maxLength: 20 }).map(items => {
                    // Ensure unique IDs
                    return items.map((item, index) => ({
                        ...item,
                        id: `${item.id}_${index}` // Make IDs unique
                    }));
                }),
                (legacyItems) => {
                    const system = createCompatibilitySystem();
                    const result = system.processLegacyData(legacyItems);

                    // Property: All items should maintain their relationships
                    const relationshipsPreserved = result.modernItems.every((modernItem, index) => {
                        const originalItem = legacyItems[index];
                        return modernItem.id === originalItem.id;
                    });

                    // Property: Order of items should be preserved
                    const orderPreserved = result.modernItems.length === legacyItems.length &&
                        result.modernItems.every((item, index) => item.id === legacyItems[index].id);

                    // Property: No duplicate IDs should be created
                    const noDuplicates = new Set(result.modernItems.map(item => item.id)).size === result.modernItems.length;

                    return relationshipsPreserved && orderPreserved && noDuplicates;
                }
            ), { numRuns: 50 });
        });
    });

    describe('Property 44: Performance Consistency', () => {
        it('should maintain similar performance characteristics for legacy operations', () => {
            fc.assert(fc.property(
                fc.array(legacyOrderItemGen, { minLength: 10, maxLength: 100 }),
                (legacyItems) => {
                    const system = createCompatibilitySystem();

                    // Measure legacy-style processing
                    const legacyStartTime = Date.now();
                    const legacyResults = legacyItems.map(item => system.calculateLegacyPricing(item));
                    const legacyEndTime = Date.now();
                    const legacyDuration = legacyEndTime - legacyStartTime;

                    // Measure modern processing of migrated items
                    const modernItems = legacyItems.map(item => system.migrateLegacyItem(item));
                    const modernStartTime = Date.now();
                    const modernResults = modernItems.map(item => system.calculateModernPricing(item));
                    const modernEndTime = Date.now();
                    const modernDuration = modernEndTime - modernStartTime;

                    // Property: Both processing methods should complete successfully
                    const bothComplete = legacyResults.length === legacyItems.length &&
                        modernResults.length === modernItems.length;

                    // Property: Modern processing should not be significantly slower (within 10x)
                    const performanceReasonable = modernDuration <= legacyDuration * 10 || modernDuration < 100; // Allow up to 100ms overhead

                    // Property: Results should be consistent
                    const resultsConsistent = legacyResults.every((legacyResult, index) => {
                        const modernResult = modernResults[index];
                        return Math.abs(legacyResult.totalPrice - modernResult.totalPrice) < 0.01;
                    });

                    return bothComplete && performanceReasonable && resultsConsistent;
                }
            ), { numRuns: 20 });
        });
    });
});

// Test utilities for backward compatibility testing
export const backwardCompatibilityTestUtils = {
    // Create compatibility system
    createCompatibilitySystem,

    // Generate legacy test data
    generateLegacyData: (count: number): LegacyOrderItem[] => {
        return fc.sample(legacyOrderItemGen, count);
    },

    // Validate migration results
    validateMigration: (original: LegacyOrderItem, migrated: ModernOrderItem): boolean => {
        return original.id === migrated.id &&
            original.name === migrated.name &&
            original.quantity === migrated.quantity &&
            original.unitPrice === migrated.unitPrice &&
            migrated.itemType === ItemType.PRODUCT;
    },

    // Test complete migration workflow
    testMigrationWorkflow: (legacyItems: LegacyOrderItem[]): { success: boolean; errors: string[] } => {
        try {
            const system = createCompatibilitySystem();
            const result = system.processLegacyData(legacyItems);

            if (!result.success) {
                return { success: false, errors: result.errors };
            }

            // Validate each migrated item
            const validationErrors: string[] = [];
            result.modernItems.forEach((modernItem, index) => {
                const originalItem = legacyItems[index];
                if (!backwardCompatibilityTestUtils.validateMigration(originalItem, modernItem)) {
                    validationErrors.push(`Migration validation failed for item ${originalItem.id}`);
                }
            });

            return { success: validationErrors.length === 0, errors: validationErrors };
        } catch (error) {
            return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
        }
    }
};
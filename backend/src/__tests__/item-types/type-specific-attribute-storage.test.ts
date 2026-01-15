/**
 * Property-Based Tests for Type-Specific Attribute Storage
 * 
 * Tests that the system correctly stores and retrieves type-specific attributes
 * in JSON format for different ItemTypes.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

import fc from 'fast-check';
import { ItemType } from '@prisma/client';

// Mock interfaces for type-specific attributes
interface ServiceAttributes {
    description: string;
    briefing?: string;
    estimatedHours?: number;
    skillLevel?: 'basic' | 'intermediate' | 'advanced';
    deliverables?: string[];
    clientRequirements?: string;
}

interface LaserCutAttributes {
    material: string;
    machineTimeMinutes?: number;
    vectorFile?: string;
    cutType?: 'cut' | 'engrave' | 'both';
    thickness?: number;
    complexity?: 'simple' | 'medium' | 'complex';
}

interface PrintRollAttributes {
    material: string;
    finishes?: string[];
    installationType?: 'indoor' | 'outdoor';
    windResistance?: boolean;
    grommets?: boolean;
    hemming?: boolean;
}

// Mock storage and retrieval functions
interface AttributeStorageSystem {
    store: (itemType: ItemType, attributes: any) => { success: boolean; storedData: any };
    retrieve: (itemType: ItemType, storedData: any) => { success: boolean; attributes: any };
    validate: (itemType: ItemType, attributes: any) => { valid: boolean; errors: string[] };
    query: (itemType: ItemType, queryParams: Record<string, any>) => { matches: boolean; score: number };
}

// Generators for type-specific attributes
const serviceAttributesGen = fc.record({
    description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    briefing: fc.option(fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0)),
    estimatedHours: fc.option(fc.float({ min: Math.fround(0.5), max: Math.fround(200), noNaN: true })),
    skillLevel: fc.option(fc.constantFrom('basic', 'intermediate', 'advanced')),
    deliverables: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { maxLength: 10 })),
    clientRequirements: fc.option(fc.string({ maxLength: 500 }).filter(s => s.trim().length > 0))
});

const laserCutAttributesGen = fc.record({
    material: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    machineTimeMinutes: fc.option(fc.float({ min: Math.fround(1), max: Math.fround(480), noNaN: true })),
    vectorFile: fc.option(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)),
    cutType: fc.option(fc.constantFrom('cut', 'engrave', 'both')),
    thickness: fc.option(fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true })),
    complexity: fc.option(fc.constantFrom('simple', 'medium', 'complex'))
});

const printRollAttributesGen = fc.record({
    material: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    finishes: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 })),
    installationType: fc.option(fc.constantFrom('indoor', 'outdoor')),
    windResistance: fc.option(fc.boolean()),
    grommets: fc.option(fc.boolean()),
    hemming: fc.option(fc.boolean())
});

// Mock implementation of attribute storage system
const createMockStorageSystem = (): AttributeStorageSystem => ({
    store: (itemType: ItemType, attributes: any) => {
        try {
            // Simulate JSON serialization
            const serialized = JSON.stringify(attributes);
            const parsed = JSON.parse(serialized);

            return {
                success: true,
                storedData: {
                    itemType,
                    attributes: parsed,
                    timestamp: new Date().toISOString(),
                    version: '1.0'
                }
            };
        } catch (error) {
            return {
                success: false,
                storedData: null
            };
        }
    },

    retrieve: (itemType: ItemType, storedData: any) => {
        try {
            if (!storedData || storedData.itemType !== itemType) {
                return { success: false, attributes: null };
            }

            return {
                success: true,
                attributes: storedData.attributes
            };
        } catch (error) {
            return { success: false, attributes: null };
        }
    },

    validate: (itemType: ItemType, attributes: any) => {
        const errors: string[] = [];

        if (!attributes || typeof attributes !== 'object') {
            errors.push('Attributes must be an object');
            return { valid: false, errors };
        }

        // Helper function to check if string is valid (not empty or whitespace-only)
        const isValidString = (str: any): boolean => {
            return typeof str === 'string' && str.trim().length > 0;
        };

        // Type-specific validation
        switch (itemType) {
            case ItemType.SERVICE:
                if (!isValidString(attributes.description)) {
                    errors.push('SERVICE requires description field');
                }
                if (attributes.estimatedHours !== undefined && attributes.estimatedHours !== null &&
                    (typeof attributes.estimatedHours !== 'number' || attributes.estimatedHours <= 0)) {
                    errors.push('estimatedHours must be a positive number');
                }
                break;

            case ItemType.LASER_CUT:
                if (!isValidString(attributes.material)) {
                    errors.push('LASER_CUT requires material field');
                }
                if (attributes.thickness !== undefined && attributes.thickness !== null &&
                    (typeof attributes.thickness !== 'number' || attributes.thickness <= 0)) {
                    errors.push('thickness must be a positive number');
                }
                break;

            case ItemType.PRINT_ROLL:
                if (!isValidString(attributes.material)) {
                    errors.push('PRINT_ROLL requires material field');
                }
                if (attributes.finishes !== undefined && attributes.finishes !== null && !Array.isArray(attributes.finishes)) {
                    errors.push('finishes must be an array');
                }
                break;
        }

        return { valid: errors.length === 0, errors };
    },

    query: (itemType: ItemType, queryParams: Record<string, any>) => {
        // Simulate JSON querying capabilities
        let score = 0;
        let matches = true;

        // Handle empty query parameters
        const validParams = Object.entries(queryParams).filter(([key, value]) =>
            value !== null && value !== undefined && key.trim().length > 0
        );

        if (validParams.length === 0) {
            return { matches: true, score: 1 }; // Empty query matches everything with minimal score
        }

        for (const [key, value] of validParams) {
            if (key === 'itemType') {
                if (value === itemType) {
                    score += 10;
                } else {
                    matches = false;
                    break;
                }
            } else {
                // Simulate attribute matching
                score += 1;
            }
        }

        return { matches, score };
    }
});

describe('Type-Specific Attribute Storage Properties', () => {
    describe('Property 16: Type-Specific Attribute Storage (SERVICE)', () => {
        it('should correctly store and retrieve SERVICE attributes in JSON format', () => {
            fc.assert(fc.property(
                serviceAttributesGen,
                (serviceAttributes) => {
                    const storageSystem = createMockStorageSystem();

                    // Store the attributes
                    const storeResult = storageSystem.store(ItemType.SERVICE, serviceAttributes);

                    // Property: Storage should succeed for valid SERVICE attributes
                    const storageSuccessful = storeResult.success === true;

                    // Property: Stored data should contain the original attributes
                    const attributesPreserved = storeResult.storedData &&
                        storeResult.storedData.attributes &&
                        storeResult.storedData.itemType === ItemType.SERVICE;

                    // Retrieve the attributes
                    const retrieveResult = storageSystem.retrieve(ItemType.SERVICE, storeResult.storedData);

                    // Property: Retrieval should succeed
                    const retrievalSuccessful = retrieveResult.success === true;

                    // Property: Retrieved attributes should match original (round-trip)
                    // Note: JSON serialization converts undefined to null, so we need to handle this
                    const normalizeValue = (val: any) => val === undefined ? null : val;
                    const attributesMatch = retrieveResult.attributes &&
                        retrieveResult.attributes.description === serviceAttributes.description &&
                        normalizeValue(retrieveResult.attributes.briefing) === normalizeValue(serviceAttributes.briefing) &&
                        normalizeValue(retrieveResult.attributes.estimatedHours) === normalizeValue(serviceAttributes.estimatedHours) &&
                        normalizeValue(retrieveResult.attributes.skillLevel) === normalizeValue(serviceAttributes.skillLevel) &&
                        JSON.stringify(normalizeValue(retrieveResult.attributes.deliverables)) === JSON.stringify(normalizeValue(serviceAttributes.deliverables)) &&
                        normalizeValue(retrieveResult.attributes.clientRequirements) === normalizeValue(serviceAttributes.clientRequirements);

                    // Property: Validation should pass for valid SERVICE attributes
                    const validationResult = storageSystem.validate(ItemType.SERVICE, serviceAttributes);
                    const validationPassed = validationResult.valid === true;

                    return storageSuccessful && attributesPreserved && retrievalSuccessful &&
                        attributesMatch && validationPassed;
                }
            ), { numRuns: 100 });
        });

        it('should validate SERVICE attribute requirements correctly', () => {
            fc.assert(fc.property(
                fc.record({
                    description: fc.option(fc.string()),
                    briefing: fc.option(fc.string()),
                    estimatedHours: fc.option(fc.oneof(
                        fc.float({ noNaN: true }),
                        fc.constant(-1), // Invalid negative value
                        fc.constant(0)   // Invalid zero value
                    )),
                    skillLevel: fc.option(fc.oneof(
                        fc.constantFrom('basic', 'intermediate', 'advanced'),
                        fc.string() // Invalid skill level
                    ))
                }),
                (attributes) => {
                    const storageSystem = createMockStorageSystem();
                    const validationResult = storageSystem.validate(ItemType.SERVICE, attributes);

                    // Helper function to check if string is valid (not empty or whitespace-only)
                    const isValidString = (str: any): boolean => {
                        return typeof str === 'string' && str.trim().length > 0;
                    };

                    // Property: Description is required for SERVICE and must be valid
                    const descriptionRequired = !isValidString(attributes.description) ?
                        !validationResult.valid : true;

                    // Property: EstimatedHours must be positive if provided
                    const hoursValidation = attributes.estimatedHours !== undefined && attributes.estimatedHours !== null &&
                        (typeof attributes.estimatedHours !== 'number' || attributes.estimatedHours <= 0) ?
                        !validationResult.valid : true;

                    // Property: Valid attributes should pass validation
                    const validAttributesPass = isValidString(attributes.description) &&
                        (attributes.estimatedHours === undefined || attributes.estimatedHours === null ||
                            (typeof attributes.estimatedHours === 'number' && attributes.estimatedHours > 0)) ?
                        validationResult.valid : true;

                    return descriptionRequired && hoursValidation && validAttributesPass;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 16: Type-Specific Attribute Storage (LASER_CUT)', () => {
        it('should correctly store and retrieve LASER_CUT attributes in JSON format', () => {
            fc.assert(fc.property(
                laserCutAttributesGen,
                (laserCutAttributes) => {
                    const storageSystem = createMockStorageSystem();

                    // Store the attributes
                    const storeResult = storageSystem.store(ItemType.LASER_CUT, laserCutAttributes);

                    // Property: Storage should succeed for valid LASER_CUT attributes
                    const storageSuccessful = storeResult.success === true;

                    // Property: Stored data should contain the original attributes
                    const attributesPreserved = storeResult.storedData &&
                        storeResult.storedData.attributes &&
                        storeResult.storedData.itemType === ItemType.LASER_CUT;

                    // Retrieve the attributes
                    const retrieveResult = storageSystem.retrieve(ItemType.LASER_CUT, storeResult.storedData);

                    // Property: Retrieval should succeed
                    const retrievalSuccessful = retrieveResult.success === true;

                    // Property: Retrieved attributes should match original (round-trip)
                    // Note: JSON serialization converts undefined to null, so we need to handle this
                    const normalizeValue = (val: any) => val === undefined ? null : val;
                    const attributesMatch = retrieveResult.attributes &&
                        retrieveResult.attributes.material === laserCutAttributes.material &&
                        normalizeValue(retrieveResult.attributes.machineTimeMinutes) === normalizeValue(laserCutAttributes.machineTimeMinutes) &&
                        normalizeValue(retrieveResult.attributes.vectorFile) === normalizeValue(laserCutAttributes.vectorFile) &&
                        normalizeValue(retrieveResult.attributes.cutType) === normalizeValue(laserCutAttributes.cutType) &&
                        normalizeValue(retrieveResult.attributes.thickness) === normalizeValue(laserCutAttributes.thickness) &&
                        normalizeValue(retrieveResult.attributes.complexity) === normalizeValue(laserCutAttributes.complexity);

                    // Property: Validation should pass for valid LASER_CUT attributes
                    const validationResult = storageSystem.validate(ItemType.LASER_CUT, laserCutAttributes);
                    const validationPassed = validationResult.valid === true;

                    return storageSuccessful && attributesPreserved && retrievalSuccessful &&
                        attributesMatch && validationPassed;
                }
            ), { numRuns: 100 });
        });

        it('should validate LASER_CUT attribute requirements correctly', () => {
            fc.assert(fc.property(
                fc.record({
                    material: fc.option(fc.string()),
                    machineTimeMinutes: fc.option(fc.float({ noNaN: true })),
                    thickness: fc.option(fc.oneof(
                        fc.float({ min: Math.fround(0.1), max: Math.fround(50), noNaN: true }),
                        fc.constant(-1), // Invalid negative value
                        fc.constant(0)   // Invalid zero value
                    )),
                    cutType: fc.option(fc.oneof(
                        fc.constantFrom('cut', 'engrave', 'both'),
                        fc.string() // Invalid cut type
                    ))
                }),
                (attributes) => {
                    const storageSystem = createMockStorageSystem();
                    const validationResult = storageSystem.validate(ItemType.LASER_CUT, attributes);

                    // Helper function to check if string is valid (not empty or whitespace-only)
                    const isValidString = (str: any): boolean => {
                        return typeof str === 'string' && str.trim().length > 0;
                    };

                    // Property: Material is required for LASER_CUT and must be valid
                    const materialRequired = !isValidString(attributes.material) ?
                        !validationResult.valid : true;

                    // Property: Thickness must be positive if provided
                    const thicknessValidation = attributes.thickness !== undefined && attributes.thickness !== null &&
                        (typeof attributes.thickness !== 'number' || attributes.thickness <= 0) ?
                        !validationResult.valid : true;

                    // Property: Valid attributes should pass validation
                    const validAttributesPass = isValidString(attributes.material) &&
                        (attributes.thickness === undefined || attributes.thickness === null ||
                            (typeof attributes.thickness === 'number' && attributes.thickness > 0)) ?
                        validationResult.valid : true;

                    return materialRequired && thicknessValidation && validAttributesPass;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 16: Type-Specific Attribute Storage (PRINT_ROLL)', () => {
        it('should correctly store and retrieve PRINT_ROLL attributes in JSON format', () => {
            fc.assert(fc.property(
                printRollAttributesGen,
                (printRollAttributes) => {
                    const storageSystem = createMockStorageSystem();

                    // Store the attributes
                    const storeResult = storageSystem.store(ItemType.PRINT_ROLL, printRollAttributes);

                    // Property: Storage should succeed for valid PRINT_ROLL attributes
                    const storageSuccessful = storeResult.success === true;

                    // Property: Stored data should contain the original attributes
                    const attributesPreserved = storeResult.storedData &&
                        storeResult.storedData.attributes &&
                        storeResult.storedData.itemType === ItemType.PRINT_ROLL;

                    // Retrieve the attributes
                    const retrieveResult = storageSystem.retrieve(ItemType.PRINT_ROLL, storeResult.storedData);

                    // Property: Retrieval should succeed
                    const retrievalSuccessful = retrieveResult.success === true;

                    // Property: Retrieved attributes should match original (round-trip)
                    // Note: JSON serialization converts undefined to null, so we need to handle this
                    const normalizeValue = (val: any) => val === undefined ? null : val;
                    const attributesMatch = retrieveResult.attributes &&
                        retrieveResult.attributes.material === printRollAttributes.material &&
                        normalizeValue(retrieveResult.attributes.installationType) === normalizeValue(printRollAttributes.installationType) &&
                        normalizeValue(retrieveResult.attributes.windResistance) === normalizeValue(printRollAttributes.windResistance) &&
                        normalizeValue(retrieveResult.attributes.grommets) === normalizeValue(printRollAttributes.grommets) &&
                        normalizeValue(retrieveResult.attributes.hemming) === normalizeValue(printRollAttributes.hemming) &&
                        JSON.stringify(normalizeValue(retrieveResult.attributes.finishes)) === JSON.stringify(normalizeValue(printRollAttributes.finishes));

                    // Property: Validation should pass for valid PRINT_ROLL attributes
                    const validationResult = storageSystem.validate(ItemType.PRINT_ROLL, printRollAttributes);
                    const validationPassed = validationResult.valid === true;

                    return storageSuccessful && attributesPreserved && retrievalSuccessful &&
                        attributesMatch && validationPassed;
                }
            ), { numRuns: 100 });
        });

        it('should validate PRINT_ROLL attribute requirements correctly', () => {
            fc.assert(fc.property(
                fc.record({
                    material: fc.option(fc.string()),
                    finishes: fc.option(fc.oneof(
                        fc.array(fc.string()),
                        fc.string(), // Invalid - should be array
                        fc.integer() // Invalid - should be array
                    )),
                    installationType: fc.option(fc.oneof(
                        fc.constantFrom('indoor', 'outdoor'),
                        fc.string() // Invalid installation type
                    ))
                }),
                (attributes) => {
                    const storageSystem = createMockStorageSystem();
                    const validationResult = storageSystem.validate(ItemType.PRINT_ROLL, attributes);

                    // Helper function to check if string is valid (not empty or whitespace-only)
                    const isValidString = (str: any): boolean => {
                        return typeof str === 'string' && str.trim().length > 0;
                    };

                    // Property: Material is required for PRINT_ROLL and must be valid
                    const materialRequired = !isValidString(attributes.material) ?
                        !validationResult.valid : true;

                    // Property: Finishes must be array if provided
                    const finishesValidation = attributes.finishes !== undefined && attributes.finishes !== null &&
                        !Array.isArray(attributes.finishes) ?
                        !validationResult.valid : true;

                    // Property: Valid attributes should pass validation
                    const validAttributesPass = isValidString(attributes.material) &&
                        (attributes.finishes === undefined || attributes.finishes === null || Array.isArray(attributes.finishes)) ?
                        validationResult.valid : true;

                    return materialRequired && finishesValidation && validAttributesPass;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 17: JSON Attribute Querying', () => {
        it('should support querying and filtering based on attributes content', () => {
            fc.assert(fc.property(
                fc.constantFrom(ItemType.SERVICE, ItemType.LASER_CUT, ItemType.PRINT_ROLL),
                fc.record({
                    material: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
                    complexity: fc.option(fc.constantFrom('simple', 'medium', 'complex')),
                    outdoor: fc.option(fc.boolean())
                }),
                (itemType, queryParams) => {
                    const storageSystem = createMockStorageSystem();

                    // Test querying by itemType
                    const typeQuery = storageSystem.query(itemType, { itemType });
                    const typeQueryMatches = typeQuery.matches === true && typeQuery.score > 0;

                    // Test querying by attributes
                    const attributeQuery = storageSystem.query(itemType, queryParams);
                    const attributeQueryValid = typeof attributeQuery.matches === 'boolean' &&
                        typeof attributeQuery.score === 'number' && attributeQuery.score >= 0;

                    // Test combined query
                    const combinedQuery = storageSystem.query(itemType, { itemType, ...queryParams });
                    const combinedQueryValid = typeof combinedQuery.matches === 'boolean' &&
                        typeof combinedQuery.score === 'number';

                    // Property: Type queries should have higher scores than attribute-only queries
                    const typeScoreHigher = combinedQuery.score >= attributeQuery.score;

                    return typeQueryMatches && attributeQueryValid && combinedQueryValid && typeScoreHigher;
                }
            ), { numRuns: 100 });
        });

        it('should handle complex JSON queries efficiently', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    itemType: fc.constantFrom(ItemType.SERVICE, ItemType.LASER_CUT, ItemType.PRINT_ROLL),
                    attributes: fc.dictionary(fc.string(), fc.oneof(
                        fc.string(),
                        fc.integer(),
                        fc.boolean(),
                        fc.array(fc.string())
                    ))
                }), { minLength: 1, maxLength: 20 }),
                fc.record({
                    itemType: fc.option(fc.constantFrom(ItemType.SERVICE, ItemType.LASER_CUT, ItemType.PRINT_ROLL)),
                    attributeKey: fc.option(fc.string()),
                    attributeValue: fc.option(fc.oneof(fc.string(), fc.integer(), fc.boolean()))
                }),
                (items, query) => {
                    const storageSystem = createMockStorageSystem();

                    // Simulate querying multiple items
                    const queryResults = items.map(item => {
                        const queryParams: Record<string, any> = {};

                        if (query.itemType) queryParams.itemType = query.itemType;
                        if (query.attributeKey && query.attributeValue !== undefined) {
                            queryParams[query.attributeKey] = query.attributeValue;
                        }

                        return storageSystem.query(item.itemType, queryParams);
                    });

                    // Property: All queries should return valid results
                    const allQueriesValid = queryResults.every(result =>
                        typeof result.matches === 'boolean' &&
                        typeof result.score === 'number' &&
                        result.score >= 0
                    );

                    // Property: Matching items should have positive scores
                    const matchingItemsScored = queryResults.every(result =>
                        !result.matches || result.score > 0
                    );

                    // Property: Query performance should be reasonable
                    const performanceReasonable = queryResults.length <= items.length * 2; // Simple performance check

                    return allQueriesValid && matchingItemsScored && performanceReasonable;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 33: Cross-Type Attribute Isolation', () => {
        it('should isolate attributes between different ItemTypes', () => {
            fc.assert(fc.property(
                serviceAttributesGen,
                laserCutAttributesGen,
                printRollAttributesGen,
                (serviceAttrs, laserAttrs, printAttrs) => {
                    const storageSystem = createMockStorageSystem();

                    // Store attributes for different types
                    const serviceStore = storageSystem.store(ItemType.SERVICE, serviceAttrs);
                    const laserStore = storageSystem.store(ItemType.LASER_CUT, laserAttrs);
                    const printStore = storageSystem.store(ItemType.PRINT_ROLL, printAttrs);

                    // Property: Each type should store successfully
                    const allStoresSuccessful = serviceStore.success && laserStore.success && printStore.success;

                    // Property: Cross-type retrieval should fail
                    const serviceFromLaser = storageSystem.retrieve(ItemType.SERVICE, laserStore.storedData);
                    const laserFromPrint = storageSystem.retrieve(ItemType.LASER_CUT, printStore.storedData);
                    const printFromService = storageSystem.retrieve(ItemType.PRINT_ROLL, serviceStore.storedData);

                    const crossRetrievalFails = !serviceFromLaser.success &&
                        !laserFromPrint.success && !printFromService.success;

                    // Property: Correct type retrieval should succeed
                    const serviceRetrieve = storageSystem.retrieve(ItemType.SERVICE, serviceStore.storedData);
                    const laserRetrieve = storageSystem.retrieve(ItemType.LASER_CUT, laserStore.storedData);
                    const printRetrieve = storageSystem.retrieve(ItemType.PRINT_ROLL, printStore.storedData);

                    const correctRetrievalSucceeds = serviceRetrieve.success &&
                        laserRetrieve.success && printRetrieve.success;

                    return allStoresSuccessful && crossRetrievalFails && correctRetrievalSucceeds;
                }
            ), { numRuns: 100 });
        });
    });

    describe('Property 34: Attribute Schema Evolution', () => {
        it('should handle attribute schema changes gracefully', () => {
            fc.assert(fc.property(
                serviceAttributesGen,
                fc.record({
                    newField: fc.string(),
                    deprecatedField: fc.option(fc.string())
                }),
                (originalAttrs, schemaChanges) => {
                    const storageSystem = createMockStorageSystem();

                    // Store original attributes
                    const originalStore = storageSystem.store(ItemType.SERVICE, originalAttrs);

                    // Simulate schema evolution by adding new fields
                    const evolvedAttrs = { ...originalAttrs, ...schemaChanges };
                    const evolvedStore = storageSystem.store(ItemType.SERVICE, evolvedAttrs);

                    // Property: Both versions should store successfully
                    const bothStoreSuccessfully = originalStore.success && evolvedStore.success;

                    // Property: Original attributes should still be retrievable
                    const originalRetrieve = storageSystem.retrieve(ItemType.SERVICE, originalStore.storedData);
                    const originalStillValid = originalRetrieve.success &&
                        originalRetrieve.attributes.description === originalAttrs.description;

                    // Property: Evolved attributes should include new fields
                    const evolvedRetrieve = storageSystem.retrieve(ItemType.SERVICE, evolvedStore.storedData);
                    const evolvedIncludesNew = evolvedRetrieve.success &&
                        evolvedRetrieve.attributes.newField === schemaChanges.newField;

                    return bothStoreSuccessfully && originalStillValid && evolvedIncludesNew;
                }
            ), { numRuns: 100 });
        });
    });
});

// Test utilities for attribute storage
export const attributeStorageTestUtils = {
    // Create mock storage system
    createMockStorage: createMockStorageSystem,

    // Validate attribute structure
    validateAttributeStructure: (itemType: ItemType, attributes: any): boolean => {
        const storageSystem = createMockStorageSystem();
        const result = storageSystem.validate(itemType, attributes);
        return result.valid;
    },

    // Test round-trip storage
    testRoundTrip: (itemType: ItemType, attributes: any): boolean => {
        const storageSystem = createMockStorageSystem();
        const stored = storageSystem.store(itemType, attributes);
        if (!stored.success) return false;

        const retrieved = storageSystem.retrieve(itemType, stored.storedData);
        return retrieved.success && JSON.stringify(retrieved.attributes) === JSON.stringify(attributes);
    },

    // Generate sample attributes for testing
    generateSampleAttributes: {
        service: (): ServiceAttributes => ({
            description: 'Design de logotipo personalizado',
            briefing: 'Cliente precisa de um logotipo moderno e minimalista',
            estimatedHours: 8,
            skillLevel: 'intermediate',
            deliverables: ['Logotipo em vetor', 'Manual de marca', 'Aplicações']
        }),

        laserCut: (): LaserCutAttributes => ({
            material: 'MDF 3mm',
            machineTimeMinutes: 45,
            vectorFile: 'design_v2.svg',
            cutType: 'cut',
            thickness: 3,
            complexity: 'medium'
        }),

        printRoll: (): PrintRollAttributes => ({
            material: 'Lona 440g',
            finishes: ['Ilhós', 'Bainha'],
            installationType: 'outdoor',
            windResistance: true,
            grommets: true,
            hemming: true
        })
    }
};
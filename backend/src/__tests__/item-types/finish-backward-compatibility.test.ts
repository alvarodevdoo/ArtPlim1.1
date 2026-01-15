/**
 * Property-Based Tests for Finish Backward Compatibility
 * Feature: tipos-produtos, Property 12: Finish Backward Compatibility
 * Validates: Requirements 5.5
 */

import fc from 'fast-check';
import { FinishService, FinishFilters } from '../../modules/catalog/services/FinishService';
import { ItemType } from '@prisma/client';

// Mock PrismaClient for testing
const mockPrisma = {
    finish: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
} as any;

describe('Finish Backward Compatibility Properties', () => {
    let finishService: FinishService;

    beforeEach(() => {
        finishService = new FinishService(mockPrisma);
        jest.clearAllMocks();
    });

    /**
     * Property 12: Finish Backward Compatibility
     * Legacy finishes without allowedTypes should be compatible with all product types
     */
    test('should treat legacy finishes (empty allowedTypes) as universal', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT),
                fc.constant(ItemType.PRODUCT)
            ),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.constant([]), // Legacy finish - no type restrictions
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.constant(true), // Only active finishes
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 10 }),
            async (requestedType: ItemType, organizationId: string, legacyFinishes: any[]) => {
                // Configurar acabamentos legados para a organização
                const orgLegacyFinishes = legacyFinishes.map(finish => ({
                    ...finish,
                    organizationId
                }));

                mockPrisma.finish.findMany.mockResolvedValue(orgLegacyFinishes);

                const result = await finishService.listByType(requestedType, organizationId);

                // Todos os acabamentos legados devem estar disponíveis para qualquer tipo
                expect(result).toHaveLength(orgLegacyFinishes.length);

                result.forEach(finish => {
                    expect(finish.allowedTypes).toEqual([]);
                    expect(finish.organizationId).toBe(organizationId);
                    expect(finish.active).toBe(true);
                });

                // Verificar se foi chamado com filtros corretos para incluir acabamentos universais
                expect(mockPrisma.finish.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        OR: [
                            { allowedTypes: { has: requestedType } },
                            { allowedTypes: { isEmpty: true } } // Inclui acabamentos legados
                        ],
                        active: true
                    },
                    orderBy: [
                        { name: 'asc' }
                    ]
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Mixed environment compatibility
     * System should handle both legacy (empty allowedTypes) and new (specific allowedTypes) finishes
     */
    test('should handle mixed legacy and modern finishes correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Legacy-${s}`),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.constant([]), // Legacy finish
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 5 }),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Modern-${s}`),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.array(fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ), { minLength: 1, maxLength: 2 }), // Modern finish with specific types
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 5 }),
            async (requestedType: ItemType, organizationId: string, legacyFinishes: any[], modernFinishes: any[]) => {
                // Configurar acabamentos para a mesma organização
                const allFinishes = [
                    ...legacyFinishes.map(f => ({ ...f, organizationId })),
                    ...modernFinishes.map(f => ({ ...f, organizationId }))
                ];

                // Filtrar acabamentos compatíveis
                const compatibleFinishes = allFinishes.filter(finish =>
                    finish.allowedTypes.length === 0 || // Legacy (universal)
                    finish.allowedTypes.includes(requestedType) // Modern compatible
                );

                mockPrisma.finish.findMany.mockResolvedValue(compatibleFinishes);

                const result = await finishService.listByType(requestedType, organizationId);

                // Verificar se incluiu acabamentos legados e modernos compatíveis
                const legacyCount = result.filter(f => f.allowedTypes.length === 0).length;
                const modernCount = result.filter(f => f.allowedTypes.length > 0).length;

                expect(legacyCount).toBeGreaterThan(0); // Deve incluir acabamentos legados
                expect(result).toHaveLength(compatibleFinishes.length);

                // Todos os resultados devem ser compatíveis
                result.forEach(finish => {
                    const isCompatible = finish.allowedTypes.length === 0 ||
                        finish.allowedTypes.includes(requestedType);
                    expect(isCompatible).toBe(true);
                    expect(finish.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Legacy finish compatibility check
     * isCompatibleWithType should return true for legacy finishes with any type
     */
    test('should identify legacy finishes as compatible with all types', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT),
                fc.constant(ItemType.PRODUCT)
            ),
            fc.uuid(),
            fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.constant([]), // Legacy finish
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }),
            async (finishId: string, testType: ItemType, organizationId: string, legacyFinish: any) => {
                legacyFinish.organizationId = organizationId;
                mockPrisma.finish.findFirst.mockResolvedValue(legacyFinish);

                const isCompatible = await finishService.isCompatibleWithType(finishId, testType, organizationId);

                // Acabamento legado deve ser compatível com qualquer tipo
                expect(isCompatible).toBe(true);

                expect(mockPrisma.finish.findFirst).toHaveBeenCalledWith({
                    where: {
                        id: finishId,
                        organizationId
                    }
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: No type filter should return all finishes (legacy behavior)
     * When no type filter is applied, should return all finishes including legacy ones
     */
    test('should return all finishes when no type filter is applied', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.oneof(
                    fc.constant([]), // Legacy finish
                    fc.array(fc.oneof(
                        fc.constant(ItemType.PRINT_SHEET),
                        fc.constant(ItemType.PRINT_ROLL),
                        fc.constant(ItemType.LASER_CUT)
                    ), { minLength: 1, maxLength: 2 }) // Modern finish
                ),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 15 }),
            async (organizationId: string, mixedFinishes: any[]) => {
                // Configurar acabamentos para a organização
                const orgFinishes = mixedFinishes.map(finish => ({
                    ...finish,
                    organizationId
                }));

                mockPrisma.finish.findMany.mockResolvedValue(orgFinishes);

                const filters: FinishFilters = {
                    organizationId
                    // Sem filtro de tipo - deve retornar todos
                };

                const result = await finishService.list(filters);

                // Deve retornar todos os acabamentos da organização
                expect(result).toHaveLength(orgFinishes.length);

                result.forEach(finish => {
                    expect(finish.organizationId).toBe(organizationId);
                });

                // Verificar se foi chamado sem filtro de tipo
                expect(mockPrisma.finish.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId
                    },
                    orderBy: [
                        { name: 'asc' }
                    ]
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Migration scenario - existing finishes should work
     * Simulates the scenario where existing finishes are migrated to the new system
     */
    test('should handle migration scenario where existing finishes become universal', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.constant([]), // Migrated finish - empty array
                priceType: fc.constant('FIXED'), // Legacy price type
                priceValue: fc.float({ min: 0, max: 100 }), // Legacy price range
                processingTime: fc.option(fc.integer({ min: 5, max: 60 }), { nil: undefined }),
                requiresSetup: fc.constant(false), // Legacy setup
                organizationId: fc.uuid(),
                active: fc.constant(true),
                createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2023-12-31') }), // Old dates
                updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2023-12-31') })
            }), { minLength: 1, maxLength: 10 }),
            fc.array(fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT),
                fc.constant(ItemType.PRODUCT)
            ), { minLength: 1, maxLength: 5 }),
            async (organizationId: string, migratedFinishes: any[], testTypes: ItemType[]) => {
                // Configurar acabamentos migrados
                const orgFinishes = migratedFinishes.map(finish => ({
                    ...finish,
                    organizationId
                }));

                mockPrisma.finish.findMany.mockResolvedValue(orgFinishes);

                // Testar compatibilidade com todos os tipos
                for (const testType of testTypes) {
                    const result = await finishService.listByType(testType, organizationId);

                    // Todos os acabamentos migrados devem estar disponíveis para qualquer tipo
                    expect(result).toHaveLength(orgFinishes.length);

                    result.forEach(finish => {
                        expect(finish.allowedTypes).toEqual([]);
                        expect(finish.organizationId).toBe(organizationId);
                        expect(finish.active).toBe(true);
                    });
                }
            }
        ), { numRuns: 50 });
    });

    /**
     * Property: Gradual migration support
     * System should support gradual migration where some finishes get specific types while others remain universal
     */
    test('should support gradual migration from universal to specific types', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL)
            ),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Universal-${s}`),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.constant([]), // Still universal
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 3 }),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `Specific-${s}`),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.array(fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL)
                ), { minLength: 1, maxLength: 1 }), // Already migrated to specific
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 3 }),
            async (requestedType: ItemType, organizationId: string, universalFinishes: any[], specificFinishes: any[]) => {
                // Configurar acabamentos para a mesma organização
                const allFinishes = [
                    ...universalFinishes.map(f => ({ ...f, organizationId })),
                    ...specificFinishes.map(f => ({ ...f, organizationId }))
                ];

                // Filtrar acabamentos compatíveis
                const compatibleFinishes = allFinishes.filter(finish =>
                    finish.allowedTypes.length === 0 || // Universal (not yet migrated)
                    finish.allowedTypes.includes(requestedType) // Specific and compatible
                );

                mockPrisma.finish.findMany.mockResolvedValue(compatibleFinishes);

                const result = await finishService.listByType(requestedType, organizationId);

                // Deve incluir acabamentos universais e específicos compatíveis
                const universalCount = result.filter(f => f.allowedTypes.length === 0).length;
                const specificCount = result.filter(f => f.allowedTypes.length > 0).length;

                expect(universalCount).toBeGreaterThan(0); // Deve incluir universais
                expect(result).toHaveLength(compatibleFinishes.length);

                // Verificar compatibilidade de todos os resultados
                result.forEach(finish => {
                    const isCompatible = finish.allowedTypes.length === 0 ||
                        finish.allowedTypes.includes(requestedType);
                    expect(isCompatible).toBe(true);
                    expect(finish.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });
});
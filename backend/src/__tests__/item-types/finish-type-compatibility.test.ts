/**
 * Property-Based Tests for Finish Type Compatibility
 * Feature: tipos-produtos, Property 11: Finish Type Compatibility
 * Validates: Requirements 5.2, 5.3
 */

import fc from 'fast-check';
import { FinishService, CreateFinishDTO, FinishFilters } from '../../modules/catalog/services/FinishService';
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

describe('Finish Type Compatibility Properties', () => {
    let finishService: FinishService;

    beforeEach(() => {
        finishService = new FinishService(mockPrisma);
        jest.clearAllMocks();
    });

    /**
     * Property 11: Finish Type Compatibility
     * For any finish with specific allowedTypes, only those types should be compatible
     */
    test('should filter finishes by compatible ItemType correctly', async () => {
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
                allowedTypes: fc.oneof(
                    fc.constant([]), // Empty array = all types allowed
                    fc.array(fc.oneof(
                        fc.constant(ItemType.SERVICE),
                        fc.constant(ItemType.PRINT_SHEET),
                        fc.constant(ItemType.PRINT_ROLL),
                        fc.constant(ItemType.LASER_CUT),
                        fc.constant(ItemType.PRODUCT)
                    ), { minLength: 1, maxLength: 3 })
                ),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 20 }),
            async (filterType: ItemType, organizationId: string, mockFinishes: any[]) => {
                // Filtrar acabamentos compatíveis com o tipo
                const compatibleFinishes = mockFinishes.filter(finish =>
                    finish.organizationId === organizationId &&
                    (finish.allowedTypes.length === 0 || finish.allowedTypes.includes(filterType))
                );

                // Configurar mock para retornar dados filtrados
                mockPrisma.finish.findMany.mockResolvedValue(compatibleFinishes);

                const filters: FinishFilters = {
                    organizationId,
                    type: filterType
                };

                const result = await finishService.list(filters);

                // Verificar se o Prisma foi chamado com os filtros corretos
                expect(mockPrisma.finish.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        OR: [
                            { allowedTypes: { has: filterType } },
                            { allowedTypes: { isEmpty: true } }
                        ]
                    },
                    orderBy: [
                        { name: 'asc' }
                    ]
                });

                // Verificar se todos os resultados são compatíveis com o tipo
                result.forEach(finish => {
                    expect(finish.organizationId).toBe(organizationId);
                    // Deve ser compatível: allowedTypes vazio OU contém o tipo
                    const isCompatible = finish.allowedTypes.length === 0 ||
                        finish.allowedTypes.includes(filterType);
                    expect(isCompatible).toBe(true);
                });

                // Verificar se o número de resultados está correto
                expect(result).toHaveLength(compatibleFinishes.length);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Universal finishes (empty allowedTypes) are compatible with all types
     */
    test('should include universal finishes for any ItemType', async () => {
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
                allowedTypes: fc.constant([]), // Universal finish
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 10 }),
            async (filterType: ItemType, organizationId: string, universalFinishes: any[]) => {
                // Filtrar apenas acabamentos da organização
                const orgFinishes = universalFinishes.filter(finish =>
                    finish.organizationId === organizationId
                );

                mockPrisma.finish.findMany.mockResolvedValue(orgFinishes);

                const result = await finishService.listByType(filterType, organizationId);

                // Todos os acabamentos universais devem estar incluídos
                result.forEach(finish => {
                    expect(finish.allowedTypes).toEqual([]);
                    expect(finish.organizationId).toBe(organizationId);
                });

                expect(result).toHaveLength(orgFinishes.length);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Specific finishes are only compatible with their allowed types
     */
    test('should exclude incompatible specific finishes', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRODUCT)
            ),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.array(fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ), { minLength: 1, maxLength: 2 }),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 1, maxLength: 10 }),
            async (allowedType: ItemType, requestedType: ItemType, organizationId: string, specificFinishes: any[]) => {
                // Ensure the types are different
                if (allowedType === requestedType) {
                    return;
                }

                // Configurar acabamentos específicos para um tipo diferente do solicitado
                const finishesWithSpecificType = specificFinishes.map(finish => ({
                    ...finish,
                    organizationId,
                    allowedTypes: [allowedType] // Só permite um tipo específico
                }));

                // Simular que não há acabamentos compatíveis
                mockPrisma.finish.findMany.mockResolvedValue([]);

                const result = await finishService.listByType(requestedType, organizationId);

                // Não deve retornar acabamentos incompatíveis
                expect(result).toHaveLength(0);

                // Verificar se foi chamado com filtros corretos
                expect(mockPrisma.finish.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        OR: [
                            { allowedTypes: { has: requestedType } },
                            { allowedTypes: { isEmpty: true } }
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
     * Property: isCompatibleWithType method consistency
     */
    test('should correctly identify compatibility using isCompatibleWithType', async () => {
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
                allowedTypes: fc.oneof(
                    fc.constant([]), // Universal
                    fc.array(fc.oneof(
                        fc.constant(ItemType.SERVICE),
                        fc.constant(ItemType.PRINT_SHEET),
                        fc.constant(ItemType.PRINT_ROLL),
                        fc.constant(ItemType.LASER_CUT),
                        fc.constant(ItemType.PRODUCT)
                    ), { minLength: 1, maxLength: 3 })
                ),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }),
            async (finishId: string, testType: ItemType, organizationId: string, mockFinish: any) => {
                mockFinish.organizationId = organizationId;
                mockPrisma.finish.findFirst.mockResolvedValue(mockFinish);

                const isCompatible = await finishService.isCompatibleWithType(finishId, testType, organizationId);

                // Verificar se foi chamado corretamente
                expect(mockPrisma.finish.findFirst).toHaveBeenCalledWith({
                    where: {
                        id: finishId,
                        organizationId
                    }
                });

                // Verificar lógica de compatibilidade
                const expectedCompatibility = mockFinish.allowedTypes.length === 0 ||
                    mockFinish.allowedTypes.includes(testType);
                expect(isCompatible).toBe(expectedCompatibility);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Organization isolation for finishes
     */
    test('should isolate finishes by organization', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.uuid(),
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL)
            ),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.oneof(
                    fc.constant([]),
                    fc.array(fc.oneof(
                        fc.constant(ItemType.PRINT_SHEET),
                        fc.constant(ItemType.PRINT_ROLL)
                    ), { minLength: 1, maxLength: 2 })
                ),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.oneof(fc.uuid(), fc.uuid()), // Mix of different org IDs
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (targetOrgId: string, otherOrgId: string, filterType: ItemType, mockFinishes: any[]) => {
                // Ensure we have different organization IDs
                if (targetOrgId === otherOrgId) {
                    return;
                }

                // Filtrar apenas para a organização alvo e tipo compatível
                const orgFinishes = mockFinishes.filter(finish =>
                    finish.organizationId === targetOrgId &&
                    (finish.allowedTypes.length === 0 || finish.allowedTypes.includes(filterType))
                );

                mockPrisma.finish.findMany.mockResolvedValue(orgFinishes);

                const result = await finishService.listByType(filterType, targetOrgId);

                // Verificar se todos os resultados pertencem à organização correta
                result.forEach(finish => {
                    expect(finish.organizationId).toBe(targetOrgId);
                    expect(finish.organizationId).not.toBe(otherOrgId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Active status filtering
     */
    test('should filter by active status correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(),
            fc.uuid(),
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL)
            ),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.option(fc.string(), { nil: undefined }),
                allowedTypes: fc.oneof(
                    fc.constant([]),
                    fc.array(fc.oneof(
                        fc.constant(ItemType.PRINT_SHEET),
                        fc.constant(ItemType.PRINT_ROLL)
                    ), { minLength: 1, maxLength: 2 })
                ),
                priceType: fc.oneof(fc.constant('FIXED'), fc.constant('PERCENTAGE'), fc.constant('PER_UNIT')),
                priceValue: fc.float({ min: 0, max: 1000 }),
                processingTime: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
                requiresSetup: fc.boolean(),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (activeFilter: boolean, organizationId: string, filterType: ItemType, mockFinishes: any[]) => {
                // Filtrar por status ativo, organização e compatibilidade
                const filteredFinishes = mockFinishes.filter(finish =>
                    finish.organizationId === organizationId &&
                    finish.active === activeFilter &&
                    (finish.allowedTypes.length === 0 || finish.allowedTypes.includes(filterType))
                );

                mockPrisma.finish.findMany.mockResolvedValue(filteredFinishes);

                const result = await finishService.listByType(filterType, organizationId, activeFilter);

                // Verificar se todos os resultados têm o status correto
                result.forEach(finish => {
                    expect(finish.active).toBe(activeFilter);
                    expect(finish.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });
});
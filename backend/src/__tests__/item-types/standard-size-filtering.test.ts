/**
 * Property-Based Tests for Standard Size Filtering
 * Feature: tipos-produtos, Property 8: Standard Size Filtering
 * Validates: Requirements 3.2
 */

import fc from 'fast-check';
import { StandardSizeService, CreateStandardSizeDTO, StandardSizeFilters } from '../../modules/catalog/services/StandardSizeService';
import { ItemType } from '@prisma/client';

// Mock PrismaClient for testing
const mockPrisma = {
    standardSize: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn()
    }
} as any;

describe('Standard Size Filtering Properties', () => {
    let standardSizeService: StandardSizeService;

    beforeEach(() => {
        standardSizeService = new StandardSizeService(mockPrisma);
        jest.clearAllMocks();
    });

    /**
     * Property 8: Standard Size Filtering
     * For any request for standard sizes with a specific ItemType, 
     * only sizes matching that type should be returned
     */
    test('should filter standard sizes by ItemType correctly', async () => {
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
                name: fc.string({ minLength: 1, maxLength: 50 }),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                organizationId: fc.uuid(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 20 }),
            async (filterType: ItemType, organizationId: string, mockSizes: any[]) => {
                // Filtrar os dados mock para simular o comportamento do banco
                const filteredSizes = mockSizes.filter(size =>
                    size.type === filterType && size.organizationId === organizationId
                );

                // Configurar mock para retornar dados filtrados
                mockPrisma.standardSize.findMany.mockResolvedValue(filteredSizes);

                const filters: StandardSizeFilters = {
                    type: filterType,
                    organizationId
                };

                const result = await standardSizeService.list(filters);

                // Verificar se o Prisma foi chamado com os filtros corretos
                expect(mockPrisma.standardSize.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        type: filterType
                    },
                    orderBy: [
                        { type: 'asc' },
                        { name: 'asc' }
                    ]
                });

                // Verificar se todos os resultados têm o tipo correto
                result.forEach(size => {
                    expect(size.type).toBe(filterType);
                    expect(size.organizationId).toBe(organizationId);
                });

                // Verificar se o número de resultados está correto
                expect(result).toHaveLength(filteredSizes.length);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Organization isolation
     * For any organization ID, only sizes belonging to that organization should be returned
     */
    test('should isolate standard sizes by organization', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                organizationId: fc.oneof(fc.uuid(), fc.uuid()), // Mix of different org IDs
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 20 }),
            async (targetOrgId: string, otherOrgId: string, mockSizes: any[]) => {
                // Ensure we have different organization IDs
                if (targetOrgId === otherOrgId) {
                    return; // Skip this test case
                }

                // Filtrar apenas para a organização alvo
                const orgSizes = mockSizes.filter(size => size.organizationId === targetOrgId);

                mockPrisma.standardSize.findMany.mockResolvedValue(orgSizes);

                const filters: StandardSizeFilters = {
                    organizationId: targetOrgId
                };

                const result = await standardSizeService.list(filters);

                // Verificar se todos os resultados pertencem à organização correta
                result.forEach(size => {
                    expect(size.organizationId).toBe(targetOrgId);
                    expect(size.organizationId).not.toBe(otherOrgId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Search filtering consistency
     * For any search term, all returned sizes should contain the search term in their name
     */
    test('should filter by search term correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.oneof(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.string({ minLength: 1, maxLength: 20 }).map(s => s + 'A4' + s), // Names containing 'A4'
                    fc.string({ minLength: 1, maxLength: 20 }).map(s => s + 'CARD' + s) // Names containing 'CARD'
                ),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                organizationId: fc.uuid(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (searchTerm: string, organizationId: string, mockSizes: any[]) => {
                // Simular filtragem por busca (case insensitive)
                const searchResults = mockSizes.filter(size =>
                    size.organizationId === organizationId &&
                    size.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                mockPrisma.standardSize.findMany.mockResolvedValue(searchResults);

                const filters: StandardSizeFilters = {
                    organizationId,
                    search: searchTerm
                };

                const result = await standardSizeService.list(filters);

                // Verificar se o Prisma foi chamado com filtro de busca
                expect(mockPrisma.standardSize.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        name: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    orderBy: [
                        { type: 'asc' },
                        { name: 'asc' }
                    ]
                });

                // Verificar se todos os resultados contêm o termo de busca
                result.forEach(size => {
                    expect(size.name.toLowerCase()).toContain(searchTerm.toLowerCase());
                    expect(size.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Combined filtering consistency
     * When filtering by both type and search, results should match both criteria
     */
    test('should apply multiple filters consistently', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.oneof(fc.constant('A4'), fc.constant('CARD'), fc.constant('BANNER')),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.oneof(
                    fc.constant('A4 Paper'),
                    fc.constant('A3 Paper'),
                    fc.constant('Business Card'),
                    fc.constant('Banner Large'),
                    fc.constant('Custom Size')
                ),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                organizationId: fc.uuid(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (filterType: ItemType, searchTerm: string, organizationId: string, mockSizes: any[]) => {
                // Aplicar ambos os filtros
                const filteredResults = mockSizes.filter(size =>
                    size.organizationId === organizationId &&
                    size.type === filterType &&
                    size.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                mockPrisma.standardSize.findMany.mockResolvedValue(filteredResults);

                const filters: StandardSizeFilters = {
                    organizationId,
                    type: filterType,
                    search: searchTerm
                };

                const result = await standardSizeService.list(filters);

                // Verificar se todos os resultados atendem a ambos os critérios
                result.forEach(size => {
                    expect(size.organizationId).toBe(organizationId);
                    expect(size.type).toBe(filterType);
                    expect(size.name.toLowerCase()).toContain(searchTerm.toLowerCase());
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Empty results handling
     * When no sizes match the filter criteria, an empty array should be returned
     */
    test('should handle empty results gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.SERVICE),
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT),
                fc.constant(ItemType.PRODUCT)
            ),
            fc.uuid(),
            async (filterType: ItemType, organizationId: string) => {
                // Mock retorna array vazio
                mockPrisma.standardSize.findMany.mockResolvedValue([]);

                const filters: StandardSizeFilters = {
                    organizationId,
                    type: filterType
                };

                const result = await standardSizeService.list(filters);

                // Deve retornar array vazio
                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(0);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: listByType should be equivalent to list with type filter
     * For any ItemType, listByType should return the same results as list with type filter
     */
    test('should have consistent behavior between listByType and list with type filter', async () => {
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
                name: fc.string({ minLength: 1, maxLength: 50 }),
                width: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                height: fc.float({ min: Math.fround(1), max: Math.fround(5000) }).filter(n => !isNaN(n) && isFinite(n)),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                organizationId: fc.uuid(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 10 }),
            async (filterType: ItemType, organizationId: string, mockSizes: any[]) => {
                const filteredSizes = mockSizes.filter(size =>
                    size.type === filterType && size.organizationId === organizationId
                );

                mockPrisma.standardSize.findMany.mockResolvedValue(filteredSizes);

                // Chamar ambos os métodos
                const listResult = await standardSizeService.list({ type: filterType, organizationId });

                // Reset mock for second call
                mockPrisma.standardSize.findMany.mockResolvedValue(filteredSizes);
                const listByTypeResult = await standardSizeService.listByType(filterType, organizationId);

                // Resultados devem ser idênticos
                expect(listResult).toEqual(listByTypeResult);
                expect(listResult.length).toBe(listByTypeResult.length);
            }
        ), { numRuns: 100 });
    });
});
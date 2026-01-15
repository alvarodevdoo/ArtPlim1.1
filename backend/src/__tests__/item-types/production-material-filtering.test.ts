/**
 * Property-Based Tests for Material Type Filtering
 * Feature: tipos-produtos, Property 10: Material Type Filtering
 * Validates: Requirements 4.2
 */

import fc from 'fast-check';
import { ProductionMaterialService, CreateProductionMaterialDTO, ProductionMaterialFilters } from '../../modules/catalog/services/ProductionMaterialService';
import { ItemType } from '@prisma/client';

// Mock PrismaClient for testing
const mockPrisma = {
    productionMaterial: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn()
    }
} as any;

describe('Material Type Filtering Properties', () => {
    let productionMaterialService: ProductionMaterialService;

    beforeEach(() => {
        productionMaterialService = new ProductionMaterialService(mockPrisma);
        jest.clearAllMocks();
    });

    /**
     * Property 10: Material Type Filtering
     * For any request for materials with a specific ItemType, 
     * only materials compatible with that type should be returned
     */
    test('should filter production materials by ItemType correctly', async () => {
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
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 20 }),
            async (filterType: ItemType, organizationId: string, mockMaterials: any[]) => {
                // Filtrar os dados mock para simular o comportamento do banco
                const filteredMaterials = mockMaterials.filter(material =>
                    material.type === filterType && material.organizationId === organizationId
                );

                // Configurar mock para retornar dados filtrados
                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredMaterials);

                const filters: ProductionMaterialFilters = {
                    type: filterType,
                    organizationId
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se o Prisma foi chamado com os filtros corretos
                expect(mockPrisma.productionMaterial.findMany).toHaveBeenCalledWith({
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
                result.forEach(material => {
                    expect(material.type).toBe(filterType);
                    expect(material.organizationId).toBe(organizationId);
                });

                // Verificar se o número de resultados está correto
                expect(result).toHaveLength(filteredMaterials.length);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Organization isolation for materials
     * For any organization ID, only materials belonging to that organization should be returned
     */
    test('should isolate production materials by organization', async () => {
        await fc.assert(fc.asyncProperty(
            fc.uuid(),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                type: fc.oneof(
                    fc.constant(ItemType.SERVICE),
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT),
                    fc.constant(ItemType.PRODUCT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.oneof(fc.uuid(), fc.uuid()), // Mix of different org IDs
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 20 }),
            async (targetOrgId: string, otherOrgId: string, mockMaterials: any[]) => {
                // Ensure we have different organization IDs
                if (targetOrgId === otherOrgId) {
                    return; // Skip this test case
                }

                // Filtrar apenas para a organização alvo
                const orgMaterials = mockMaterials.filter(material => material.organizationId === targetOrgId);

                mockPrisma.productionMaterial.findMany.mockResolvedValue(orgMaterials);

                const filters: ProductionMaterialFilters = {
                    organizationId: targetOrgId
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se todos os resultados pertencem à organização correta
                result.forEach(material => {
                    expect(material.organizationId).toBe(targetOrgId);
                    expect(material.organizationId).not.toBe(otherOrgId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Active status filtering
     * When filtering by active status, only materials with matching status should be returned
     */
    test('should filter by active status correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                type: fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (activeFilter: boolean, organizationId: string, mockMaterials: any[]) => {
                // Filtrar por status ativo e organização
                const filteredMaterials = mockMaterials.filter(material =>
                    material.organizationId === organizationId && material.active === activeFilter
                );

                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredMaterials);

                const filters: ProductionMaterialFilters = {
                    organizationId,
                    active: activeFilter
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se o Prisma foi chamado com filtro de status
                expect(mockPrisma.productionMaterial.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        active: activeFilter
                    },
                    orderBy: [
                        { type: 'asc' },
                        { name: 'asc' }
                    ]
                });

                // Verificar se todos os resultados têm o status correto
                result.forEach(material => {
                    expect(material.active).toBe(activeFilter);
                    expect(material.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Price range filtering
     * When filtering by price range, only materials within the range should be returned
     */
    test('should filter by price range correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.float({ min: Math.fround(1), max: Math.fround(100) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.float({ min: Math.fround(200), max: Math.fround(500) }).filter(n => !isNaN(n) && isFinite(n)),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                type: fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (minPrice: number, maxPrice: number, organizationId: string, mockMaterials: any[]) => {
                // Ensure min < max
                if (minPrice >= maxPrice) {
                    return; // Skip this test case
                }

                // Filtrar por faixa de preço
                const filteredMaterials = mockMaterials.filter(material =>
                    material.organizationId === organizationId &&
                    material.salesPrice >= minPrice &&
                    material.salesPrice <= maxPrice
                );

                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredMaterials);

                const filters: ProductionMaterialFilters = {
                    organizationId,
                    priceRange: {
                        min: minPrice,
                        max: maxPrice
                    }
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se o Prisma foi chamado com filtro de preço
                expect(mockPrisma.productionMaterial.findMany).toHaveBeenCalledWith({
                    where: {
                        organizationId,
                        salesPrice: {
                            gte: minPrice,
                            lte: maxPrice
                        }
                    },
                    orderBy: [
                        { type: 'asc' },
                        { name: 'asc' }
                    ]
                });

                // Verificar se todos os resultados estão na faixa de preço
                result.forEach(material => {
                    expect(material.salesPrice).toBeGreaterThanOrEqual(minPrice);
                    expect(material.salesPrice).toBeLessThanOrEqual(maxPrice);
                    expect(material.organizationId).toBe(organizationId);
                });
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Search filtering consistency
     * For any search term, all returned materials should contain the search term in their name
     */
    test('should filter by search term correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.oneof(
                    fc.string({ minLength: 1, maxLength: 50 }),
                    fc.string({ minLength: 1, maxLength: 20 }).map(s => s + 'MDF' + s), // Names containing 'MDF'
                    fc.string({ minLength: 1, maxLength: 20 }).map(s => s + 'LONA' + s) // Names containing 'LONA'
                ),
                type: fc.oneof(
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.boolean(),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (searchTerm: string, organizationId: string, mockMaterials: any[]) => {
                // Simular filtragem por busca (case insensitive)
                const searchResults = mockMaterials.filter(material =>
                    material.organizationId === organizationId &&
                    material.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                mockPrisma.productionMaterial.findMany.mockResolvedValue(searchResults);

                const filters: ProductionMaterialFilters = {
                    organizationId,
                    search: searchTerm
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se o Prisma foi chamado com filtro de busca
                expect(mockPrisma.productionMaterial.findMany).toHaveBeenCalledWith({
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
                result.forEach(material => {
                    expect(material.name.toLowerCase()).toContain(searchTerm.toLowerCase());
                    expect(material.organizationId).toBe(organizationId);
                });
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
                fc.constant(ItemType.PRINT_SHEET),
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                type: fc.oneof(
                    fc.constant(ItemType.PRINT_SHEET),
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.constant(true), // listByType filters active by default
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 10 }),
            async (filterType: ItemType, organizationId: string, mockMaterials: any[]) => {
                const filteredMaterials = mockMaterials.filter(material =>
                    material.type === filterType &&
                    material.organizationId === organizationId &&
                    material.active === true
                );

                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredMaterials);

                // Chamar ambos os métodos
                const listResult = await productionMaterialService.list({
                    type: filterType,
                    organizationId,
                    active: true
                });

                // Reset mock for second call
                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredMaterials);
                const listByTypeResult = await productionMaterialService.listByType(filterType, organizationId, true);

                // Resultados devem ser idênticos
                expect(listResult).toEqual(listByTypeResult);
                expect(listResult.length).toBe(listByTypeResult.length);
            }
        ), { numRuns: 100 });
    });

    /**
     * Property: Combined filtering should apply all criteria
     * When multiple filters are applied, results should match all criteria
     */
    test('should apply multiple filters consistently', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant(ItemType.PRINT_ROLL),
                fc.constant(ItemType.LASER_CUT)
            ),
            fc.oneof(fc.constant('MDF'), fc.constant('LONA')),
            fc.uuid(),
            fc.array(fc.record({
                id: fc.uuid(),
                name: fc.oneof(
                    fc.constant('MDF 3mm'),
                    fc.constant('MDF 6mm'),
                    fc.constant('Lona 440g'),
                    fc.constant('Lona 520g'),
                    fc.constant('Acrílico')
                ),
                type: fc.oneof(
                    fc.constant(ItemType.PRINT_ROLL),
                    fc.constant(ItemType.LASER_CUT)
                ),
                costPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }).filter(n => !isNaN(n) && isFinite(n)),
                salesPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(2000) }).filter(n => !isNaN(n) && isFinite(n)),
                properties: fc.record({}),
                organizationId: fc.uuid(),
                active: fc.constant(true),
                createdAt: fc.date(),
                updatedAt: fc.date()
            }), { minLength: 0, maxLength: 15 }),
            async (filterType: ItemType, searchTerm: string, organizationId: string, mockMaterials: any[]) => {
                // Aplicar todos os filtros
                const filteredResults = mockMaterials.filter(material =>
                    material.organizationId === organizationId &&
                    material.type === filterType &&
                    material.active === true &&
                    material.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                mockPrisma.productionMaterial.findMany.mockResolvedValue(filteredResults);

                const filters: ProductionMaterialFilters = {
                    organizationId,
                    type: filterType,
                    search: searchTerm,
                    active: true
                };

                const result = await productionMaterialService.list(filters);

                // Verificar se todos os resultados atendem a todos os critérios
                result.forEach(material => {
                    expect(material.organizationId).toBe(organizationId);
                    expect(material.type).toBe(filterType);
                    expect(material.active).toBe(true);
                    expect(material.name.toLowerCase()).toContain(searchTerm.toLowerCase());
                });
            }
        ), { numRuns: 100 });
    });
});
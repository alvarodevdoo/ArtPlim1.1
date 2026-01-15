/**
 * ProductionMaterialService - Serviço para gerenciar materiais de produção por tipo
 * 
 * Este serviço implementa operações CRUD para ProductionMaterial, incluindo
 * filtragem por ItemType, gestão de preços e propriedades específicas.
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

import { PrismaClient, ProductionMaterial, ItemType } from '@prisma/client';

export interface CreateProductionMaterialDTO {
    name: string;
    type: ItemType;
    costPrice: number;
    salesPrice: number;
    properties?: any;
    organizationId: string;
}

export interface UpdateProductionMaterialDTO {
    name?: string;
    type?: ItemType;
    costPrice?: number;
    salesPrice?: number;
    properties?: any;
    active?: boolean;
}

export interface ProductionMaterialFilters {
    type?: ItemType;
    organizationId: string;
    search?: string;
    active?: boolean;
    priceRange?: {
        min?: number;
        max?: number;
    };
}

export class ProductionMaterialService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Lista materiais de produção com filtros opcionais
     * Requirements: 4.2 - Filtrar materiais por tipo
     */
    async list(filters: ProductionMaterialFilters): Promise<ProductionMaterial[]> {
        const where: any = {
            organizationId: filters.organizationId
        };

        // Filtrar por tipo se especificado
        if (filters.type) {
            where.type = filters.type;
        }

        // Filtrar por status ativo
        if (filters.active !== undefined) {
            where.active = filters.active;
        }

        // Filtrar por nome se especificado
        if (filters.search) {
            where.name = {
                contains: filters.search,
                mode: 'insensitive'
            };
        }

        // Filtrar por faixa de preço
        if (filters.priceRange) {
            where.salesPrice = {};
            if (filters.priceRange.min !== undefined) {
                where.salesPrice.gte = filters.priceRange.min;
            }
            if (filters.priceRange.max !== undefined) {
                where.salesPrice.lte = filters.priceRange.max;
            }
        }

        return this.prisma.productionMaterial.findMany({
            where,
            orderBy: [
                { type: 'asc' },
                { name: 'asc' }
            ]
        });
    }

    /**
     * Busca material de produção por ID
     */
    async findById(id: string, organizationId: string): Promise<ProductionMaterial | null> {
        return this.prisma.productionMaterial.findFirst({
            where: {
                id,
                organizationId
            }
        });
    }

    /**
     * Cria novo material de produção
     * Requirements: 4.1 - Criar materiais específicos por tipo
     */
    async create(data: CreateProductionMaterialDTO): Promise<ProductionMaterial> {
        // Validar dados de entrada
        this.validateProductionMaterialData(data);

        // Verificar se já existe um material com o mesmo nome e tipo
        const existing = await this.prisma.productionMaterial.findFirst({
            where: {
                name: data.name,
                type: data.type,
                organizationId: data.organizationId
            }
        });

        if (existing) {
            throw new Error(`Production material '${data.name}' already exists for type '${data.type}'`);
        }

        return this.prisma.productionMaterial.create({
            data: {
                name: data.name,
                type: data.type,
                costPrice: data.costPrice,
                salesPrice: data.salesPrice,
                properties: data.properties || {},
                organizationId: data.organizationId,
                active: true
            }
        });
    }

    /**
     * Atualiza material de produção existente
     */
    async update(id: string, organizationId: string, data: UpdateProductionMaterialDTO): Promise<ProductionMaterial> {
        // Verificar se o material existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Production material not found');
        }

        // Validar preços se fornecidos
        if (data.costPrice !== undefined) {
            this.validatePrice(data.costPrice, 'Cost price');
        }
        if (data.salesPrice !== undefined) {
            this.validatePrice(data.salesPrice, 'Sales price');
        }

        // Verificar conflito de nome se o nome está sendo alterado
        if (data.name && data.name !== existing.name) {
            const nameConflict = await this.prisma.productionMaterial.findFirst({
                where: {
                    name: data.name,
                    type: data.type ?? existing.type,
                    organizationId,
                    id: { not: id }
                }
            });

            if (nameConflict) {
                throw new Error(`Production material '${data.name}' already exists for this type`);
            }
        }

        return this.prisma.productionMaterial.update({
            where: { id },
            data
        });
    }

    /**
     * Remove material de produção (soft delete)
     */
    async delete(id: string, organizationId: string): Promise<void> {
        // Verificar se o material existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Production material not found');
        }

        // Soft delete - marcar como inativo
        await this.prisma.productionMaterial.update({
            where: { id },
            data: { active: false }
        });
    }

    /**
     * Remove material de produção permanentemente
     */
    async hardDelete(id: string, organizationId: string): Promise<void> {
        // Verificar se o material existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Production material not found');
        }

        await this.prisma.productionMaterial.delete({
            where: { id }
        });
    }

    /**
     * Lista materiais de produção por tipo específico
     * Requirements: 4.2 - Filtrar por tipo de produto
     */
    async listByType(type: ItemType, organizationId: string, activeOnly: boolean = true): Promise<ProductionMaterial[]> {
        return this.list({
            type,
            organizationId,
            active: activeOnly
        });
    }

    /**
     * Busca materiais de produção por nome (busca parcial)
     */
    async searchByName(name: string, organizationId: string, type?: ItemType): Promise<ProductionMaterial[]> {
        return this.list({
            search: name,
            organizationId,
            type,
            active: true
        });
    }

    /**
     * Obtém estatísticas de materiais por tipo
     */
    async getStatsByType(organizationId: string): Promise<Record<ItemType, { count: number; avgCost: number; avgSales: number }>> {
        const stats = await this.prisma.productionMaterial.groupBy({
            by: ['type'],
            where: {
                organizationId,
                active: true
            },
            _count: { id: true },
            _avg: {
                costPrice: true,
                salesPrice: true
            }
        });

        const result: Record<string, any> = {};

        // Inicializar todos os tipos com valores padrão
        Object.values(ItemType).forEach(type => {
            result[type] = {
                count: 0,
                avgCost: 0,
                avgSales: 0
            };
        });

        // Preencher com dados reais
        stats.forEach(stat => {
            result[stat.type] = {
                count: stat._count.id,
                avgCost: stat._avg.costPrice || 0,
                avgSales: stat._avg.salesPrice || 0
            };
        });

        return result as Record<ItemType, { count: number; avgCost: number; avgSales: number }>;
    }

    /**
     * Calcula margem de lucro para um material
     */
    calculateMargin(costPrice: number, salesPrice: number): { margin: number; percentage: number } {
        if (costPrice <= 0) {
            throw new Error('Cost price must be greater than zero');
        }

        const margin = salesPrice - costPrice;
        const percentage = (margin / costPrice) * 100;

        return { margin, percentage };
    }

    /**
     * Lista materiais com baixa margem de lucro
     */
    async findLowMarginMaterials(organizationId: string, maxMarginPercentage: number = 20): Promise<ProductionMaterial[]> {
        const materials = await this.list({ organizationId, active: true });

        return materials.filter(material => {
            const { percentage } = this.calculateMargin(Number(material.costPrice), Number(material.salesPrice));
            return percentage <= maxMarginPercentage;
        });
    }

    /**
     * Atualiza preços em lote baseado em percentual
     */
    async updatePricesInBatch(
        organizationId: string,
        type: ItemType,
        costIncrease: number,
        salesIncrease: number
    ): Promise<number> {
        const materials = await this.listByType(type, organizationId);
        let updatedCount = 0;

        for (const material of materials) {
            const newCostPrice = Number(material.costPrice) * (1 + costIncrease / 100);
            const newSalesPrice = Number(material.salesPrice) * (1 + salesIncrease / 100);

            await this.update(material.id, organizationId, {
                costPrice: newCostPrice,
                salesPrice: newSalesPrice
            });

            updatedCount++;
        }

        return updatedCount;
    }

    /**
     * Cria materiais de produção em lote
     */
    async createBatch(materials: CreateProductionMaterialDTO[]): Promise<ProductionMaterial[]> {
        const results: ProductionMaterial[] = [];

        for (const materialData of materials) {
            try {
                const created = await this.create(materialData);
                results.push(created);
            } catch (error) {
                // Log error but continue with other materials
                console.warn(`Failed to create production material '${materialData.name}':`, error);
            }
        }

        return results;
    }

    /**
     * Valida dados do material de produção
     */
    private validateProductionMaterialData(data: CreateProductionMaterialDTO): void {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Name is required');
        }

        if (data.name.length > 200) {
            throw new Error('Name must be 200 characters or less');
        }

        this.validatePrice(data.costPrice, 'Cost price');
        this.validatePrice(data.salesPrice, 'Sales price');

        if (data.salesPrice < data.costPrice) {
            console.warn(`Sales price (${data.salesPrice}) is lower than cost price (${data.costPrice}) for material '${data.name}'`);
        }

        if (!Object.values(ItemType).includes(data.type)) {
            throw new Error('Invalid ItemType');
        }

        if (!data.organizationId || data.organizationId.trim().length === 0) {
            throw new Error('Organization ID is required');
        }

        // Validar propriedades se fornecidas
        if (data.properties && typeof data.properties !== 'object') {
            throw new Error('Properties must be a valid object');
        }
    }

    /**
     * Valida preço
     */
    private validatePrice(price: number, fieldName: string): void {
        if (typeof price !== 'number' || !isFinite(price) || price < 0) {
            throw new Error(`${fieldName} must be a non-negative number`);
        }

        // Validar limite máximo razoável
        const MAX_PRICE = 1000000; // R$ 1 milhão
        if (price > MAX_PRICE) {
            throw new Error(`${fieldName} must be less than R$ ${MAX_PRICE.toLocaleString()}`);
        }
    }
}
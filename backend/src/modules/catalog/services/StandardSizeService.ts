/**
 * StandardSizeService - Serviço para gerenciar tamanhos padrão por tipo de produto
 * 
 * Este serviço implementa operações CRUD para StandardSize, incluindo
 * filtragem por ItemType e validações específicas.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { PrismaClient, StandardSize, ItemType } from '@prisma/client';

export interface CreateStandardSizeDTO {
    name: string;
    width: number;
    height: number;
    type: ItemType;
    organizationId: string;
}

export interface UpdateStandardSizeDTO {
    name?: string;
    width?: number;
    height?: number;
    type?: ItemType;
}

export interface StandardSizeFilters {
    type?: ItemType;
    organizationId: string;
    search?: string;
}

export class StandardSizeService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Lista tamanhos padrão com filtros opcionais
     * Requirements: 3.2 - Filtrar tamanhos padrão por tipo
     */
    async list(filters: StandardSizeFilters): Promise<StandardSize[]> {
        const where: any = {
            organizationId: filters.organizationId
        };

        // Filtrar por tipo se especificado
        if (filters.type) {
            where.type = filters.type;
        }

        // Filtrar por nome se especificado
        if (filters.search) {
            where.name = {
                contains: filters.search,
                mode: 'insensitive'
            };
        }

        return this.prisma.standardSize.findMany({
            where,
            orderBy: [
                { type: 'asc' },
                { name: 'asc' }
            ]
        });
    }

    /**
     * Busca tamanho padrão por ID
     */
    async findById(id: string, organizationId: string): Promise<StandardSize | null> {
        return this.prisma.standardSize.findFirst({
            where: {
                id,
                organizationId
            }
        });
    }

    /**
     * Cria novo tamanho padrão
     * Requirements: 3.1 - Criar tamanhos padrão por empresa
     */
    async create(data: CreateStandardSizeDTO): Promise<StandardSize> {
        // Validar dados de entrada
        this.validateStandardSizeData(data);

        // Verificar se já existe um tamanho com o mesmo nome e tipo
        const existing = await this.prisma.standardSize.findFirst({
            where: {
                name: data.name,
                type: data.type,
                organizationId: data.organizationId
            }
        });

        if (existing) {
            throw new Error(`Standard size '${data.name}' already exists for type '${data.type}'`);
        }

        return this.prisma.standardSize.create({
            data: {
                name: data.name,
                width: data.width,
                height: data.height,
                type: data.type,
                organizationId: data.organizationId
            }
        });
    }

    /**
     * Atualiza tamanho padrão existente
     */
    async update(id: string, organizationId: string, data: UpdateStandardSizeDTO): Promise<StandardSize> {
        // Verificar se o tamanho existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Standard size not found');
        }

        // Validar dados se fornecidos
        if (data.width !== undefined || data.height !== undefined) {
            this.validateDimensions(
                data.width ?? Number(existing.width),
                data.height ?? Number(existing.height)
            );
        }

        // Verificar conflito de nome se o nome está sendo alterado
        if (data.name && data.name !== existing.name) {
            const nameConflict = await this.prisma.standardSize.findFirst({
                where: {
                    name: data.name,
                    type: data.type ?? existing.type,
                    organizationId,
                    id: { not: id }
                }
            });

            if (nameConflict) {
                throw new Error(`Standard size '${data.name}' already exists for this type`);
            }
        }

        return this.prisma.standardSize.update({
            where: { id },
            data
        });
    }

    /**
     * Remove tamanho padrão
     */
    async delete(id: string, organizationId: string): Promise<void> {
        // Verificar se o tamanho existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Standard size not found');
        }

        await this.prisma.standardSize.delete({
            where: { id }
        });
    }

    /**
     * Lista tamanhos padrão por tipo específico
     * Requirements: 3.2 - Filtrar por tipo de produto
     */
    async listByType(type: ItemType, organizationId: string): Promise<StandardSize[]> {
        return this.list({ type, organizationId });
    }

    /**
     * Busca tamanhos padrão por nome (busca parcial)
     */
    async searchByName(name: string, organizationId: string, type?: ItemType): Promise<StandardSize[]> {
        return this.list({
            search: name,
            organizationId,
            type
        });
    }

    /**
     * Obtém estatísticas de tamanhos padrão por tipo
     */
    async getStatsByType(organizationId: string): Promise<Record<ItemType, number>> {
        const counts = await this.prisma.standardSize.groupBy({
            by: ['type'],
            where: { organizationId },
            _count: { id: true }
        });

        const stats: Record<string, number> = {};

        // Inicializar todos os tipos com 0
        Object.values(ItemType).forEach(type => {
            stats[type] = 0;
        });

        // Preencher com contagens reais
        counts.forEach(count => {
            stats[count.type] = count._count.id;
        });

        return stats as Record<ItemType, number>;
    }

    /**
     * Cria tamanhos padrão em lote
     * Útil para inicialização de dados
     */
    async createBatch(sizes: CreateStandardSizeDTO[]): Promise<StandardSize[]> {
        const results: StandardSize[] = [];

        for (const sizeData of sizes) {
            try {
                const created = await this.create(sizeData);
                results.push(created);
            } catch (error) {
                // Log error but continue with other sizes
                console.warn(`Failed to create standard size '${sizeData.name}':`, error);
            }
        }

        return results;
    }

    /**
     * Valida dados do tamanho padrão
     */
    private validateStandardSizeData(data: CreateStandardSizeDTO): void {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Name is required');
        }

        if (data.name.length > 100) {
            throw new Error('Name must be 100 characters or less');
        }

        this.validateDimensions(data.width, data.height);

        if (!Object.values(ItemType).includes(data.type)) {
            throw new Error('Invalid ItemType');
        }

        if (!data.organizationId || data.organizationId.trim().length === 0) {
            throw new Error('Organization ID is required');
        }
    }

    /**
     * Valida dimensões
     */
    private validateDimensions(width: number, height: number): void {
        if (typeof width !== 'number' || !isFinite(width) || width <= 0) {
            throw new Error('Width must be a positive number');
        }

        if (typeof height !== 'number' || !isFinite(height) || height <= 0) {
            throw new Error('Height must be a positive number');
        }

        // Validar limites razoáveis (em mm)
        const MAX_DIMENSION = 10000; // 10 metros
        const MIN_DIMENSION = 1; // 1 mm

        if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
            throw new Error(`Width must be between ${MIN_DIMENSION}mm and ${MAX_DIMENSION}mm`);
        }

        if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
            throw new Error(`Height must be between ${MIN_DIMENSION}mm and ${MAX_DIMENSION}mm`);
        }
    }
}
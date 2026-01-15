/**
 * Service for managing Finish entities
 * Handles CRUD operations and type-based filtering
 */

import { PrismaClient, Finish, ItemType } from '@prisma/client';

export interface CreateFinishDTO {
    name: string;
    description?: string;
    allowedTypes?: ItemType[];
    priceType?: string;
    priceValue?: number;
    processingTime?: number;
    requiresSetup?: boolean;
    organizationId: string;
}

export interface UpdateFinishDTO {
    name?: string;
    description?: string;
    allowedTypes?: ItemType[];
    priceType?: string;
    priceValue?: number;
    processingTime?: number;
    requiresSetup?: boolean;
    active?: boolean;
}

export interface FinishFilters {
    organizationId: string;
    type?: ItemType;
    search?: string;
    active?: boolean;
    priceType?: string;
}

export class FinishService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Lista acabamentos com filtros opcionais
     */
    async list(filters: FinishFilters): Promise<Finish[]> {
        const where: any = {
            organizationId: filters.organizationId
        };

        // Filtro por tipo de produto compatível
        if (filters.type) {
            where.OR = [
                // Acabamentos específicos para o tipo
                { allowedTypes: { has: filters.type } },
                // Acabamentos sem restrição de tipo (array vazio = todos os tipos)
                { allowedTypes: { isEmpty: true } }
            ];
        }

        // Filtro por busca no nome
        if (filters.search) {
            where.name = {
                contains: filters.search,
                mode: 'insensitive'
            };
        }

        // Filtro por status ativo
        if (filters.active !== undefined) {
            where.active = filters.active;
        }

        // Filtro por tipo de preço
        if (filters.priceType) {
            where.priceType = filters.priceType;
        }

        return this.prisma.finish.findMany({
            where,
            orderBy: [
                { name: 'asc' }
            ]
        });
    }

    /**
     * Lista acabamentos compatíveis com um tipo específico
     */
    async listByType(type: ItemType, organizationId: string, activeOnly: boolean = true): Promise<Finish[]> {
        return this.list({
            organizationId,
            type,
            active: activeOnly
        });
    }

    /**
     * Busca acabamento por ID
     */
    async findById(id: string, organizationId: string): Promise<Finish | null> {
        return this.prisma.finish.findFirst({
            where: {
                id,
                organizationId
            }
        });
    }

    /**
     * Busca acabamento por nome
     */
    async findByName(name: string, organizationId: string): Promise<Finish | null> {
        return this.prisma.finish.findFirst({
            where: {
                name,
                organizationId
            }
        });
    }

    /**
     * Cria novo acabamento
     */
    async create(data: CreateFinishDTO): Promise<Finish> {
        // Verificar se já existe acabamento com o mesmo nome
        const existing = await this.findByName(data.name, data.organizationId);
        if (existing) {
            throw new Error(`Finish '${data.name}' already exists`);
        }

        return this.prisma.finish.create({
            data: {
                name: data.name,
                description: data.description,
                allowedTypes: data.allowedTypes || [],
                priceType: data.priceType || 'FIXED',
                priceValue: data.priceValue || 0,
                processingTime: data.processingTime,
                requiresSetup: data.requiresSetup || false,
                organizationId: data.organizationId
            }
        });
    }

    /**
     * Atualiza acabamento existente
     */
    async update(id: string, organizationId: string, data: UpdateFinishDTO): Promise<Finish> {
        // Verificar se o acabamento existe
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Finish not found');
        }

        // Verificar conflito de nome se o nome está sendo alterado
        if (data.name && data.name !== existing.name) {
            const nameConflict = await this.findByName(data.name, organizationId);
            if (nameConflict) {
                throw new Error(`Finish '${data.name}' already exists`);
            }
        }

        return this.prisma.finish.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                allowedTypes: data.allowedTypes,
                priceType: data.priceType,
                priceValue: data.priceValue,
                processingTime: data.processingTime,
                requiresSetup: data.requiresSetup,
                active: data.active
            }
        });
    }

    /**
     * Remove acabamento
     */
    async delete(id: string, organizationId: string): Promise<void> {
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Finish not found');
        }

        await this.prisma.finish.delete({
            where: { id }
        });
    }

    /**
     * Verifica compatibilidade de acabamento com tipo de produto
     */
    async isCompatibleWithType(finishId: string, type: ItemType, organizationId: string): Promise<boolean> {
        const finish = await this.findById(finishId, organizationId);
        if (!finish) {
            return false;
        }

        // Se allowedTypes está vazio, é compatível com todos os tipos
        if (finish.allowedTypes.length === 0) {
            return true;
        }

        // Verificar se o tipo está na lista de tipos permitidos
        return finish.allowedTypes.includes(type);
    }

    /**
     * Lista acabamentos agrupados por tipo de preço
     */
    async groupByPriceType(organizationId: string): Promise<Record<string, Finish[]>> {
        const finishes = await this.list({ organizationId, active: true });

        return finishes.reduce((groups, finish) => {
            const priceType = finish.priceType;
            if (!groups[priceType]) {
                groups[priceType] = [];
            }
            groups[priceType].push(finish);
            return groups;
        }, {} as Record<string, Finish[]>);
    }

    /**
     * Calcula preço total do acabamento baseado no tipo
     */
    calculatePrice(finish: Finish, baseValue: number): number {
        switch (finish.priceType) {
            case 'FIXED':
                return Number(finish.priceValue);
            case 'PERCENTAGE':
                return baseValue * (Number(finish.priceValue) / 100);
            case 'PER_UNIT':
                return Number(finish.priceValue); // Será multiplicado pela quantidade externamente
            default:
                return 0;
        }
    }

    /**
     * Lista acabamentos com tempo de processamento
     */
    async listWithProcessingTime(organizationId: string, type?: ItemType): Promise<Finish[]> {
        const filters: FinishFilters = {
            organizationId,
            active: true
        };

        if (type) {
            filters.type = type;
        }

        const finishes = await this.list(filters);

        // Filtrar apenas acabamentos que têm tempo de processamento definido
        return finishes.filter(finish => finish.processingTime && finish.processingTime > 0);
    }
}
/**
 * ProductionMaterialController - Controller para endpoints de materiais de produção
 * 
 * Implementa endpoints REST para operações CRUD de ProductionMaterial
 * com filtragem por ItemType, gestão de preços e propriedades.
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

import { Request, Response } from 'express';
import { PrismaClient, ItemType } from '@prisma/client';
import { ProductionMaterialService, CreateProductionMaterialDTO, UpdateProductionMaterialDTO } from '../services/ProductionMaterialService';

export class ProductionMaterialController {
    private productionMaterialService: ProductionMaterialService;

    constructor(prisma: PrismaClient) {
        this.productionMaterialService = new ProductionMaterialService(prisma);
    }

    /**
     * GET /api/production-materials
     * Lista materiais de produção com filtros opcionais
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const { type, search, active, minPrice, maxPrice } = req.query;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            // Validar tipo se fornecido
            if (type && !Object.values(ItemType).includes(type as ItemType)) {
                res.status(400).json({ error: 'Invalid ItemType' });
                return;
            }

            const filters: any = {
                organizationId,
                type: type as ItemType,
                search: search as string
            };

            // Filtro de status ativo
            if (active !== undefined) {
                filters.active = active === 'true';
            }

            // Filtro de faixa de preço
            if (minPrice || maxPrice) {
                filters.priceRange = {};
                if (minPrice) filters.priceRange.min = parseFloat(minPrice as string);
                if (maxPrice) filters.priceRange.max = parseFloat(maxPrice as string);
            }

            const materials = await this.productionMaterialService.list(filters);

            res.json({
                success: true,
                data: materials,
                count: materials.length
            });
        } catch (error) {
            console.error('Error listing production materials:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/production-materials/:id
     * Busca material de produção por ID
     */
    async findById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const material = await this.productionMaterialService.findById(id, organizationId);

            if (!material) {
                res.status(404).json({ error: 'Production material not found' });
                return;
            }

            // Calcular margem de lucro
            const margin = this.productionMaterialService.calculateMargin(
                material.costPrice,
                material.salesPrice
            );

            res.json({
                success: true,
                data: {
                    ...material,
                    margin
                }
            });
        } catch (error) {
            console.error('Error finding production material:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/production-materials
     * Cria novo material de produção
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, type, costPrice, salesPrice, properties } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const createData: CreateProductionMaterialDTO = {
                name,
                type,
                costPrice: parseFloat(costPrice),
                salesPrice: parseFloat(salesPrice),
                properties,
                organizationId
            };

            const material = await this.productionMaterialService.create(createData);

            res.status(201).json({
                success: true,
                data: material,
                message: 'Production material created successfully'
            });
        } catch (error) {
            console.error('Error creating production material:', error);

            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    res.status(409).json({ error: error.message });
                    return;
                }
                if (error.message.includes('required') || error.message.includes('must be')) {
                    res.status(400).json({ error: error.message });
                    return;
                }
            }

            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * PUT /api/production-materials/:id
     * Atualiza material de produção existente
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, type, costPrice, salesPrice, properties, active } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const updateData: UpdateProductionMaterialDTO = {};

            if (name !== undefined) updateData.name = name;
            if (type !== undefined) updateData.type = type;
            if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice);
            if (salesPrice !== undefined) updateData.salesPrice = parseFloat(salesPrice);
            if (properties !== undefined) updateData.properties = properties;
            if (active !== undefined) updateData.active = active;

            const material = await this.productionMaterialService.update(id, organizationId, updateData);

            res.json({
                success: true,
                data: material,
                message: 'Production material updated successfully'
            });
        } catch (error) {
            console.error('Error updating production material:', error);

            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    res.status(404).json({ error: error.message });
                    return;
                }
                if (error.message.includes('already exists')) {
                    res.status(409).json({ error: error.message });
                    return;
                }
                if (error.message.includes('must be')) {
                    res.status(400).json({ error: error.message });
                    return;
                }
            }

            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * DELETE /api/production-materials/:id
     * Remove material de produção (soft delete)
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { hard } = req.query;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (hard === 'true') {
                await this.productionMaterialService.hardDelete(id, organizationId);
            } else {
                await this.productionMaterialService.delete(id, organizationId);
            }

            res.json({
                success: true,
                message: `Production material ${hard === 'true' ? 'permanently deleted' : 'deactivated'} successfully`
            });
        } catch (error) {
            console.error('Error deleting production material:', error);

            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ error: error.message });
                return;
            }

            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/production-materials/by-type/:type
     * Lista materiais de produção por tipo específico
     */
    async listByType(req: Request, res: Response): Promise<void> {
        try {
            const { type } = req.params;
            const { activeOnly } = req.query;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (!Object.values(ItemType).includes(type as ItemType)) {
                res.status(400).json({ error: 'Invalid ItemType' });
                return;
            }

            const materials = await this.productionMaterialService.listByType(
                type as ItemType,
                organizationId,
                activeOnly !== 'false'
            );

            res.json({
                success: true,
                data: materials,
                count: materials.length,
                type
            });
        } catch (error) {
            console.error('Error listing production materials by type:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/production-materials/stats
     * Obtém estatísticas de materiais por tipo
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const stats = await this.productionMaterialService.getStatsByType(organizationId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting production material stats:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/production-materials/low-margin
     * Lista materiais com baixa margem de lucro
     */
    async getLowMarginMaterials(req: Request, res: Response): Promise<void> {
        try {
            const { maxMargin } = req.query;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const maxMarginPercentage = maxMargin ? parseFloat(maxMargin as string) : 20;
            const materials = await this.productionMaterialService.findLowMarginMaterials(
                organizationId,
                maxMarginPercentage
            );

            res.json({
                success: true,
                data: materials,
                count: materials.length,
                maxMarginPercentage
            });
        } catch (error) {
            console.error('Error getting low margin materials:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/production-materials/batch
     * Cria múltiplos materiais de produção em lote
     */
    async createBatch(req: Request, res: Response): Promise<void> {
        try {
            const { materials } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (!Array.isArray(materials)) {
                res.status(400).json({ error: 'Materials must be an array' });
                return;
            }

            const materialsWithOrg = materials.map(material => ({
                ...material,
                costPrice: parseFloat(material.costPrice),
                salesPrice: parseFloat(material.salesPrice),
                organizationId
            }));

            const createdMaterials = await this.productionMaterialService.createBatch(materialsWithOrg);

            res.status(201).json({
                success: true,
                data: createdMaterials,
                count: createdMaterials.length,
                message: `${createdMaterials.length} production materials created successfully`
            });
        } catch (error) {
            console.error('Error creating production materials batch:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * PUT /api/production-materials/batch-price-update
     * Atualiza preços em lote por tipo
     */
    async updatePricesInBatch(req: Request, res: Response): Promise<void> {
        try {
            const { type, costIncrease, salesIncrease } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (!Object.values(ItemType).includes(type)) {
                res.status(400).json({ error: 'Invalid ItemType' });
                return;
            }

            const updatedCount = await this.productionMaterialService.updatePricesInBatch(
                organizationId,
                type,
                parseFloat(costIncrease),
                parseFloat(salesIncrease)
            );

            res.json({
                success: true,
                updatedCount,
                message: `${updatedCount} materials updated successfully`
            });
        } catch (error) {
            console.error('Error updating prices in batch:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
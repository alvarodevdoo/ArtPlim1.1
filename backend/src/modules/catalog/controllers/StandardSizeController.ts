/**
 * StandardSizeController - Controller para endpoints de tamanhos padrão
 * 
 * Implementa endpoints REST para operações CRUD de StandardSize
 * com filtragem por ItemType e validações.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { Request, Response } from 'express';
import { PrismaClient, ItemType } from '@prisma/client';
import { StandardSizeService, CreateStandardSizeDTO, UpdateStandardSizeDTO } from '../services/StandardSizeService';

export class StandardSizeController {
    private standardSizeService: StandardSizeService;

    constructor(prisma: PrismaClient) {
        this.standardSizeService = new StandardSizeService(prisma);
    }

    /**
     * GET /api/standard-sizes
     * Lista tamanhos padrão com filtros opcionais
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const { type, search } = req.query;
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

            const filters = {
                organizationId,
                type: type as ItemType,
                search: search as string
            };

            const standardSizes = await this.standardSizeService.list(filters);

            res.json({
                success: true,
                data: standardSizes,
                count: standardSizes.length
            });
        } catch (error) {
            console.error('Error listing standard sizes:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/standard-sizes/:id
     * Busca tamanho padrão por ID
     */
    async findById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const standardSize = await this.standardSizeService.findById(id, organizationId);

            if (!standardSize) {
                res.status(404).json({ error: 'Standard size not found' });
                return;
            }

            res.json({
                success: true,
                data: standardSize
            });
        } catch (error) {
            console.error('Error finding standard size:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/standard-sizes
     * Cria novo tamanho padrão
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, width, height, type } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const createData: CreateStandardSizeDTO = {
                name,
                width: parseFloat(width),
                height: parseFloat(height),
                type,
                organizationId
            };

            const standardSize = await this.standardSizeService.create(createData);

            res.status(201).json({
                success: true,
                data: standardSize,
                message: 'Standard size created successfully'
            });
        } catch (error) {
            console.error('Error creating standard size:', error);

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
     * PUT /api/standard-sizes/:id
     * Atualiza tamanho padrão existente
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, width, height, type } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const updateData: UpdateStandardSizeDTO = {};

            if (name !== undefined) updateData.name = name;
            if (width !== undefined) updateData.width = parseFloat(width);
            if (height !== undefined) updateData.height = parseFloat(height);
            if (type !== undefined) updateData.type = type;

            const standardSize = await this.standardSizeService.update(id, organizationId, updateData);

            res.json({
                success: true,
                data: standardSize,
                message: 'Standard size updated successfully'
            });
        } catch (error) {
            console.error('Error updating standard size:', error);

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
     * DELETE /api/standard-sizes/:id
     * Remove tamanho padrão
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            await this.standardSizeService.delete(id, organizationId);

            res.json({
                success: true,
                message: 'Standard size deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting standard size:', error);

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
     * GET /api/standard-sizes/by-type/:type
     * Lista tamanhos padrão por tipo específico
     */
    async listByType(req: Request, res: Response): Promise<void> {
        try {
            const { type } = req.params;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (!Object.values(ItemType).includes(type as ItemType)) {
                res.status(400).json({ error: 'Invalid ItemType' });
                return;
            }

            const standardSizes = await this.standardSizeService.listByType(type as ItemType, organizationId);

            res.json({
                success: true,
                data: standardSizes,
                count: standardSizes.length,
                type
            });
        } catch (error) {
            console.error('Error listing standard sizes by type:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/standard-sizes/stats
     * Obtém estatísticas de tamanhos padrão por tipo
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            const stats = await this.standardSizeService.getStatsByType(organizationId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting standard size stats:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/standard-sizes/batch
     * Cria múltiplos tamanhos padrão em lote
     */
    async createBatch(req: Request, res: Response): Promise<void> {
        try {
            const { sizes } = req.body;
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(401).json({ error: 'Organization ID required' });
                return;
            }

            if (!Array.isArray(sizes)) {
                res.status(400).json({ error: 'Sizes must be an array' });
                return;
            }

            const sizesWithOrg = sizes.map(size => ({
                ...size,
                width: parseFloat(size.width),
                height: parseFloat(size.height),
                organizationId
            }));

            const createdSizes = await this.standardSizeService.createBatch(sizesWithOrg);

            res.status(201).json({
                success: true,
                data: createdSizes,
                count: createdSizes.length,
                message: `${createdSizes.length} standard sizes created successfully`
            });
        } catch (error) {
            console.error('Error creating standard sizes batch:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
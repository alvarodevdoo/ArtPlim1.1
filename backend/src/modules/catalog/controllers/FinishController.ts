/**
 * Controller for Finish endpoints
 * Handles HTTP requests for finish management
 */

import { Request, Response } from 'express';
import { FinishService, CreateFinishDTO, UpdateFinishDTO, FinishFilters } from '../services/FinishService';
import { ItemType } from '@prisma/client';

export class FinishController {
    constructor(private finishService: FinishService) { }

    /**
     * GET /api/finishes
     * Lista acabamentos com filtros opcionais
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const filters: FinishFilters = {
                organizationId,
                type: req.query.type as ItemType,
                search: req.query.search as string,
                active: req.query.active ? req.query.active === 'true' : undefined,
                priceType: req.query.priceType as string
            };

            const finishes = await this.finishService.list(filters);
            res.json(finishes);
        } catch (error) {
            console.error('Error listing finishes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/finishes/by-type/:type
     * Lista acabamentos compatíveis com um tipo específico
     */
    async listByType(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const type = req.params.type as ItemType;
            if (!Object.values(ItemType).includes(type)) {
                res.status(400).json({ error: 'Invalid item type' });
                return;
            }

            const activeOnly = req.query.active !== 'false';
            const finishes = await this.finishService.listByType(type, organizationId, activeOnly);
            res.json(finishes);
        } catch (error) {
            console.error('Error listing finishes by type:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/finishes/:id
     * Busca acabamento por ID
     */
    async findById(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const { id } = req.params;
            const finish = await this.finishService.findById(id, organizationId);

            if (!finish) {
                res.status(404).json({ error: 'Finish not found' });
                return;
            }

            res.json(finish);
        } catch (error) {
            console.error('Error finding finish:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/finishes
     * Cria novo acabamento
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const data: CreateFinishDTO = {
                ...req.body,
                organizationId
            };

            // Validar campos obrigatórios
            if (!data.name) {
                res.status(400).json({ error: 'Name is required' });
                return;
            }

            // Validar allowedTypes se fornecido
            if (data.allowedTypes) {
                const validTypes = Object.values(ItemType);
                const invalidTypes = data.allowedTypes.filter(type => !validTypes.includes(type));
                if (invalidTypes.length > 0) {
                    res.status(400).json({
                        error: 'Invalid item types',
                        invalidTypes
                    });
                    return;
                }
            }

            // Validar priceType se fornecido
            if (data.priceType && !['FIXED', 'PERCENTAGE', 'PER_UNIT'].includes(data.priceType)) {
                res.status(400).json({ error: 'Invalid price type' });
                return;
            }

            const finish = await this.finishService.create(data);
            res.status(201).json(finish);
        } catch (error) {
            console.error('Error creating finish:', error);
            if (error instanceof Error && error.message.includes('already exists')) {
                res.status(409).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * PUT /api/finishes/:id
     * Atualiza acabamento existente
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const { id } = req.params;
            const data: UpdateFinishDTO = req.body;

            // Validar allowedTypes se fornecido
            if (data.allowedTypes) {
                const validTypes = Object.values(ItemType);
                const invalidTypes = data.allowedTypes.filter(type => !validTypes.includes(type));
                if (invalidTypes.length > 0) {
                    res.status(400).json({
                        error: 'Invalid item types',
                        invalidTypes
                    });
                    return;
                }
            }

            // Validar priceType se fornecido
            if (data.priceType && !['FIXED', 'PERCENTAGE', 'PER_UNIT'].includes(data.priceType)) {
                res.status(400).json({ error: 'Invalid price type' });
                return;
            }

            const finish = await this.finishService.update(id, organizationId, data);
            res.json(finish);
        } catch (error) {
            console.error('Error updating finish:', error);
            if (error instanceof Error) {
                if (error.message === 'Finish not found') {
                    res.status(404).json({ error: error.message });
                    return;
                }
                if (error.message.includes('already exists')) {
                    res.status(409).json({ error: error.message });
                    return;
                }
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * DELETE /api/finishes/:id
     * Remove acabamento
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const { id } = req.params;
            await this.finishService.delete(id, organizationId);
            res.status(204).send();
        } catch (error) {
            console.error('Error deleting finish:', error);
            if (error instanceof Error && error.message === 'Finish not found') {
                res.status(404).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/finishes/:id/compatibility/:type
     * Verifica compatibilidade de acabamento com tipo de produto
     */
    async checkCompatibility(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const { id, type } = req.params;

            if (!Object.values(ItemType).includes(type as ItemType)) {
                res.status(400).json({ error: 'Invalid item type' });
                return;
            }

            const isCompatible = await this.finishService.isCompatibleWithType(
                id,
                type as ItemType,
                organizationId
            );

            res.json({ compatible: isCompatible });
        } catch (error) {
            console.error('Error checking compatibility:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/finishes/grouped/by-price-type
     * Lista acabamentos agrupados por tipo de preço
     */
    async groupByPriceType(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const groups = await this.finishService.groupByPriceType(organizationId);
            res.json(groups);
        } catch (error) {
            console.error('Error grouping finishes by price type:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/finishes/with-processing-time
     * Lista acabamentos com tempo de processamento
     */
    async listWithProcessingTime(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const type = req.query.type as ItemType;
            const finishes = await this.finishService.listWithProcessingTime(organizationId, type);
            res.json(finishes);
        } catch (error) {
            console.error('Error listing finishes with processing time:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/finishes/:id/calculate-price
     * Calcula preço do acabamento baseado no valor base
     */
    async calculatePrice(req: Request, res: Response): Promise<void> {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                res.status(401).json({ error: 'Organization not found' });
                return;
            }

            const { id } = req.params;
            const { baseValue } = req.body;

            if (typeof baseValue !== 'number' || baseValue < 0) {
                res.status(400).json({ error: 'Valid base value is required' });
                return;
            }

            const finish = await this.finishService.findById(id, organizationId);
            if (!finish) {
                res.status(404).json({ error: 'Finish not found' });
                return;
            }

            const calculatedPrice = this.finishService.calculatePrice(finish, baseValue);
            res.json({
                finishId: id,
                finishName: finish.name,
                priceType: finish.priceType,
                priceValue: finish.priceValue,
                baseValue,
                calculatedPrice
            });
        } catch (error) {
            console.error('Error calculating finish price:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
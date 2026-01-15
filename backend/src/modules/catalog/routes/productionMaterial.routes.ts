/**
 * Production Material Routes
 * 
 * Define rotas REST para operações CRUD de materiais de produção
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProductionMaterialController } from '../controllers/ProductionMaterialController';

const prisma = new PrismaClient();
const productionMaterialController = new ProductionMaterialController(prisma);

const router = Router();

// GET /api/production-materials - Lista materiais com filtros
router.get('/', (req, res) => productionMaterialController.list(req, res));

// GET /api/production-materials/stats - Estatísticas por tipo
router.get('/stats', (req, res) => productionMaterialController.getStats(req, res));

// GET /api/production-materials/low-margin - Materiais com baixa margem
router.get('/low-margin', (req, res) => productionMaterialController.getLowMarginMaterials(req, res));

// GET /api/production-materials/by-type/:type - Lista por tipo específico
router.get('/by-type/:type', (req, res) => productionMaterialController.listByType(req, res));

// POST /api/production-materials/batch - Criação em lote
router.post('/batch', (req, res) => productionMaterialController.createBatch(req, res));

// PUT /api/production-materials/batch-price-update - Atualização de preços em lote
router.put('/batch-price-update', (req, res) => productionMaterialController.updatePricesInBatch(req, res));

// GET /api/production-materials/:id - Busca por ID
router.get('/:id', (req, res) => productionMaterialController.findById(req, res));

// POST /api/production-materials - Criar novo material
router.post('/', (req, res) => productionMaterialController.create(req, res));

// PUT /api/production-materials/:id - Atualizar material
router.put('/:id', (req, res) => productionMaterialController.update(req, res));

// DELETE /api/production-materials/:id - Remover material
router.delete('/:id', (req, res) => productionMaterialController.delete(req, res));

export default router;
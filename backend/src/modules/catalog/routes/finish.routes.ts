/**
 * Routes for Finish endpoints
 * Handles routing for finish management
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { FinishService } from '../services/FinishService';
import { FinishController } from '../controllers/FinishController';
import { authMiddleware } from '../../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const finishService = new FinishService(prisma);
const finishController = new FinishController(finishService);

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Rotas principais
router.get('/', (req, res) => finishController.list(req, res));
router.post('/', (req, res) => finishController.create(req, res));

// Rotas específicas (devem vir antes das rotas com parâmetros)
router.get('/by-type/:type', (req, res) => finishController.listByType(req, res));
router.get('/grouped/by-price-type', (req, res) => finishController.groupByPriceType(req, res));
router.get('/with-processing-time', (req, res) => finishController.listWithProcessingTime(req, res));

// Rotas com ID
router.get('/:id', (req, res) => finishController.findById(req, res));
router.put('/:id', (req, res) => finishController.update(req, res));
router.delete('/:id', (req, res) => finishController.delete(req, res));

// Rotas de funcionalidades específicas
router.get('/:id/compatibility/:type', (req, res) => finishController.checkCompatibility(req, res));
router.post('/:id/calculate-price', (req, res) => finishController.calculatePrice(req, res));

export default router;
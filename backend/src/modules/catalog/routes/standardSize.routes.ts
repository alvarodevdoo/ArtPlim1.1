/**
 * Standard Size Routes
 * 
 * Define rotas REST para operações CRUD de tamanhos padrão
 * Requirements: 3.1, 3.2, 3.4
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { StandardSizeController } from '../controllers/StandardSizeController';

const prisma = new PrismaClient();
const standardSizeController = new StandardSizeController(prisma);

const router = Router();

// GET /api/standard-sizes - Lista tamanhos padrão com filtros
router.get('/', (req, res) => standardSizeController.list(req, res));

// GET /api/standard-sizes/stats - Estatísticas por tipo
router.get('/stats', (req, res) => standardSizeController.getStats(req, res));

// GET /api/standard-sizes/by-type/:type - Lista por tipo específico
router.get('/by-type/:type', (req, res) => standardSizeController.listByType(req, res));

// POST /api/standard-sizes/batch - Criação em lote
router.post('/batch', (req, res) => standardSizeController.createBatch(req, res));

// GET /api/standard-sizes/:id - Busca por ID
router.get('/:id', (req, res) => standardSizeController.findById(req, res));

// POST /api/standard-sizes - Criar novo tamanho padrão
router.post('/', (req, res) => standardSizeController.create(req, res));

// PUT /api/standard-sizes/:id - Atualizar tamanho padrão
router.put('/:id', (req, res) => standardSizeController.update(req, res));

// DELETE /api/standard-sizes/:id - Remover tamanho padrão
router.delete('/:id', (req, res) => standardSizeController.delete(req, res));

export default router;
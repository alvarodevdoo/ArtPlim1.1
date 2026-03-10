import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ProcessStatusService } from './services/ProcessStatusService';

export function createCustomConfigRoutes(prisma: PrismaClient) {
    const router = Router();
    const statusService = new ProcessStatusService();

    // ========== STATUS DE PROCESSO ==========

    // Árvore de status
    router.get('/process-statuses/tree', async (req: any, res) => {
        try {
            const tree = await statusService.getTree(req.user.organizationId);
            res.json({ success: true, data: tree });
        } catch (error) {
            console.error('Erro ao buscar árvore de status:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Listar todos
    router.get('/process-statuses', async (req: any, res) => {
        try {
            const statuses = await statusService.list(req.user.organizationId);
            res.json({ success: true, data: statuses });
        } catch (error) {
            console.error('Erro ao listar status:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Criar status
    router.post('/process-statuses', async (req: any, res) => {
        try {
            const body = req.body;
            const status = await statusService.create({
                ...body,
                organizationId: req.user.organizationId
            });
            res.status(201).json({ success: true, data: status });
        } catch (error: any) {
            console.error('Erro ao criar status:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    });

    // Atualizar status
    router.put('/process-statuses/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const body = req.body;
            const status = await statusService.update(id, req.user.organizationId, body);
            res.json({ success: true, data: status });
        } catch (error: any) {
            console.error('Erro ao atualizar status:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    });

    // Deletar status
    router.delete('/process-statuses/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            await statusService.delete(id, req.user.organizationId);
            res.json({ success: true, message: 'Status removido com sucesso' });
        } catch (error: any) {
            console.error('Erro ao excluir status:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    });

    return router;
}

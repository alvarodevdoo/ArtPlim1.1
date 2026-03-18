import { FastifyInstance } from 'fastify';
import { ProcessStatusService } from './services/ProcessStatusService';

export async function customConfigRoutes(fastify: FastifyInstance) {
    const statusService = new ProcessStatusService();

    // ========== STATUS DE PROCESSO ==========

    fastify.get('/process-statuses/tree', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const tree = await statusService.getTree(request.user!.organizationId);
        return reply.send({ success: true, data: tree });
    });

    fastify.get('/process-statuses', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const statuses = await statusService.list(request.user!.organizationId);
        return reply.send({ success: true, data: statuses });
    });

    fastify.post('/process-statuses', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const status = await statusService.create({
            ...(request.body as any),
            organizationId: request.user!.organizationId
        });
        return reply.code(201).send({ success: true, data: status });
    });

    fastify.put('/process-statuses/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const status = await statusService.update(id, request.user!.organizationId, request.body as any);
        return reply.send({ success: true, data: status });
    });

    fastify.delete('/process-statuses/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        await statusService.delete(id, request.user!.organizationId);
        return reply.send({ success: true, message: 'Status removido com sucesso' });
    });
}

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { ProductionStatus, StepStatus, Priority } from '@prisma/client';

const productionOrderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  /**
   * GET /api/production/orders
   * Lista todas as ordens de produção (OPs) e suas etapas relacionais.
   */
  fastify.get('/orders', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = z.object({
      status: z.nativeEnum(ProductionStatus).optional(),
      orderNumber: z.string().optional()
    }).parse(request.query);

    const prisma = getTenantClient(request.user!.organizationId);
    
    const where: any = { organizationId: request.user!.organizationId };
    if (query.status) where.status = query.status;
    if (query.orderNumber) {
      where.orderItem = { order: { orderNumber: { contains: query.orderNumber, mode: 'insensitive' } } };
    }

    const ops = await prisma.productionOrder.findMany({
      where,
      include: {
        steps: { orderBy: { order: 'asc' } },
        orderItem: {
          include: {
            order: { select: { orderNumber: true, customer: { select: { name: true } } } },
            product: { select: { name: true } }
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return reply.send({ success: true, data: ops });
  });

  /**
   * PATCH /api/production/orders/:id/status
   * Atualiza o status da OP ou de uma etapa específica (Roteiro Relacional).
   */
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, stepId, stepStatus, notes } = z.object({
      status: z.nativeEnum(ProductionStatus).optional(),
      stepId: z.string().optional(),
      stepStatus: z.nativeEnum(StepStatus).optional(),
      notes: z.string().optional()
    }).parse(request.body);

    const prisma = getTenantClient(request.user!.organizationId);

    // 1. Atualizar etapa específica se fornecida
    if (stepId && stepStatus) {
      await prisma.productionStep.update({
        where: { id: stepId },
        data: { 
          status: stepStatus,
          startedAt: stepStatus === 'DOING' ? new Date() : undefined,
          finishedAt: stepStatus === 'DONE' ? new Date() : undefined
        }
      });
    }

    // 2. Atualizar status global da OP
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (status === 'IN_PROGRESS') updateData.startedAt = new Date();
    if (status === 'FINISHED') updateData.finishedAt = new Date();

    const op = await prisma.productionOrder.update({
      where: { id, organizationId: request.user!.organizationId },
      data: updateData,
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    return reply.send({ success: true, data: op });
  });
};

export default productionOrderRoutes;

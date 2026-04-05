import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { ProductionStatus } from '@prisma/client';

const productionOrderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  /**
   * GET /api/production/orders
   * Lista todas as ordens de produção (OPs) pendentes ou em andamento.
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
        orderItem: {
          include: {
            order: { select: { orderNumber: true, customer: { select: { name: true } } } },
            product: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: ops });
  });

  /**
   * PATCH /api/production/orders/:id/status
   * Atualiza o status de uma Ordem de Produção (ex: PENDING -> IN_PROGRESS -> COMPLETED).
   */
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, notes } = z.object({
      status: z.nativeEnum(ProductionStatus),
      notes: z.string().optional()
    }).parse(request.body);

    const prisma = getTenantClient(request.user!.organizationId);

    const data: any = { status, updatedAt: new Date() };
    if (notes) data.notes = notes;
    if (status === 'IN_PROGRESS') data.startDate = new Date();
    if (status === 'COMPLETED') data.endDate = new Date();

    const op = await prisma.productionOrder.update({
      where: { id, organizationId: request.user!.organizationId },
      data,
      include: { orderItem: { include: { order: true } } }
    });

    // Se a OP foi concluída, podemos atualizar o status do item no pedido se desejado
    // Por enquanto, apenas atualizamos a OP.

    return reply.send({ success: true, data: op });
  });
};

export default productionOrderRoutes;

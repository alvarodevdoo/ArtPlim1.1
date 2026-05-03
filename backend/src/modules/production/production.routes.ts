import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PendingChangesRepository } from './repositories/PendingChangesRepository';
import { NotificationRepository } from './repositories/NotificationRepository';
import { PendingChangesService } from './services/PendingChangesService';
import { NotificationService } from '../../shared/application/notifications/NotificationService';
import { WebSocketServer } from '../../shared/infrastructure/websocket/WebSocketServer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { requirePermission } from '../../shared/infrastructure/auth/middleware';
import { AssignTaskUseCase } from './services/AssignTaskUseCase';

export async function productionRoutes(fastify: FastifyInstance, options: { websocketServer: WebSocketServer }) {
  const { websocketServer } = options;
  
  // Como as rotas Fastify podem ser registradas múltiplas vezes (uma por organização no futuro ou com escopos diferentes),
  // idealmente usaríamos um plugin aqui.

  // Helper para obter serviços
  const getServices = (organizationId: string) => {
    const prisma = getTenantClient(organizationId);
    const pendingChangesRepository = new PendingChangesRepository(prisma);
    const notificationRepository = new NotificationRepository(prisma);
    const notificationService = new NotificationService(notificationRepository, websocketServer, prisma);
    const pendingChangesService = new PendingChangesService(pendingChangesRepository, notificationService, prisma);
    return { prisma, pendingChangesRepository, notificationRepository, notificationService, pendingChangesService };
  };

  // ==========================================
  // ROTAS DE ALTERAÇÕES PENDENTES
  // ==========================================

  fastify.get('/pending-changes', {
    preHandler: [fastify.authenticate, requirePermission(['production.view'])]
  }, async (request, reply) => {
    const { organizationId } = request.user!;
    const { pendingChangesService } = getServices(organizationId);
    const query = request.query as any;

    const result = await pendingChangesService.findByOrganization(
      organizationId,
      query,
      parseInt(query.page || '1'),
      parseInt(query.limit || '50')
    );
    return reply.send({ success: true, data: result });
  });

  fastify.get('/pending-changes/:id', {
    preHandler: [fastify.authenticate, requirePermission(['production.view'])]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { organizationId } = request.user!;
    const { pendingChangesRepository, pendingChangesService } = getServices(organizationId);

    const pendingChange = await pendingChangesRepository.findById(id);
    if (!pendingChange || pendingChange.organizationId !== organizationId) {
      return reply.code(404).send({ error: 'Não encontrado' });
    }

    const changes = pendingChangesService.analyzeChanges(pendingChange);
    return reply.send({ ...pendingChange, analyzedChanges: changes });
  });

  fastify.post('/pending-changes/:id/approve', {
    preHandler: [fastify.authenticate, requirePermission(['production.manage'])]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = request.body as { comments?: string };
    const { userId, organizationId } = request.user!;
    const { pendingChangesService } = getServices(organizationId);

    const updatedChange = await pendingChangesService.approveChange({
      pendingChangeId: id,
      reviewedBy: userId,
      comments
    });

    return reply.send({ success: true, pendingChange: updatedChange });
  });

  // ========== KANBAN ==========
  
  fastify.get('/kanban/items', {
    preHandler: [fastify.authenticate, requirePermission(['production.view'])]
  }, async (request, reply) => {
    const { organizationId } = request.user!;
    const { prisma } = getServices(organizationId);
    const { statusId, orderId, assignedUserId } = request.query as any;

    const where: any = {
      order: {
        organizationId,
        status: { notIn: ['CANCELLED', 'DELIVERED', 'DRAFT'] }
      }
    };
    if (statusId) where.processStatusId = statusId;
    if (orderId) where.orderId = orderId;
    if (assignedUserId) {
      where.order.OR = [
        { artDesignerId: assignedUserId },
        { productionUserId: assignedUserId },
        { packagingUserId: assignedUserId }
      ];
    }

    const items = await prisma.orderItem.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: { select: { name: true } },
            deliveryDate: true,
            status: true,
            artDesignerId: true,
            productionUserId: true,
            packagingUserId: true,
            artDesigner: { select: { name: true, id: true } },
            producer: { select: { name: true, id: true } },
            packer: { select: { name: true, id: true } }
          }
        },
        product: { select: { name: true } },
        processStatus: true
      },
      orderBy: { order: { deliveryDate: 'asc' } }
    });

    return reply.send({ success: true, data: items });
  });

  const assignTaskSchema = z.object({
    orderId: z.string().uuid(),
    taskType: z.enum(['art', 'prod', 'finish'])
  });

  fastify.post('/kanban/assign-task', {
    preHandler: [fastify.authenticate, requirePermission(['production.manage'])]
  }, async (request, reply) => {
    try {
      const { orderId, taskType } = assignTaskSchema.parse(request.body);
      const { id: userId, organizationId } = request.user!;
      const { prisma } = getServices(organizationId);

      const useCase = new AssignTaskUseCase(prisma);
      const updatedOrder = await useCase.execute({
        orderId,
        userId,
        taskType: taskType as any,
        organizationId
      });

      return reply.send({ success: true, data: updatedOrder });
    } catch (error: any) {
      fastify.log.error('Erro ao atribuir tarefa:', error);
      return reply.code(400).send({
        success: false,
        error: error.message || 'Não foi possível atribuir a tarefa'
      });
    }
  });

  // ==========================================
  // ROTAS DE NOTIFICAÇÕES
  // ==========================================

  fastify.get('/notifications', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { organizationId, id: userId } = request.user!;
    const { notificationRepository } = getServices(organizationId);
    const query = request.query as any;
    
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    
    const result = await notificationRepository.findByUser(organizationId, userId, {}, page, limit);
    return reply.send({ success: true, data: result.data, unreadCount: result.unreadCount });
  });

  fastify.get('/notifications/unread-count', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { organizationId, id: userId } = request.user!;
    const { notificationRepository } = getServices(organizationId);
    
    const count = await notificationRepository.getUnreadCount(organizationId, userId);
    return reply.send({ success: true, count });
  });

  fastify.post('/notifications/:id/read', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { organizationId } = request.user!;
    const { notificationRepository } = getServices(organizationId);
    
    await notificationRepository.markAsRead(id);
    return reply.send({ success: true });
  });

  fastify.post('/notifications/read-all', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { organizationId, id: userId } = request.user!;
    const { notificationRepository } = getServices(organizationId);
    
    const count = await notificationRepository.markAllAsRead(organizationId, userId);
    return reply.send({ success: true, count });
  });

  // Mais rotas seriam migradas aqui seguindo o mesmo padrão...
}
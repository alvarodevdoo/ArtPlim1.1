import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PendingChangesRepository } from './repositories/PendingChangesRepository';
import { NotificationRepository } from './repositories/NotificationRepository';
import { PendingChangesService } from './services/PendingChangesService';
import { NotificationService } from '../../shared/application/notifications/NotificationService';
import { WebSocketServer } from '../../shared/infrastructure/websocket/WebSocketServer';
import { authMiddleware } from '../../shared/infrastructure/http/middleware/authMiddleware';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../shared/infrastructure/errors/AppError';

export function createProductionRoutes(
  prisma: PrismaClient,
  websocketServer: WebSocketServer
): Router {
  const router = Router();

  // Repositories
  const pendingChangesRepository = new PendingChangesRepository(prisma);
  const notificationRepository = new NotificationRepository(prisma);

  // Services
  const notificationService = new NotificationService(
    notificationRepository,
    websocketServer,
    prisma
  );
  const pendingChangesService = new PendingChangesService(
    pendingChangesRepository,
    notificationService,
    prisma
  );

  // Middleware de autenticação para todas as rotas
  router.use(authMiddleware);

  // Middleware para validar permissões de operador
  const operatorAuthMiddleware = (req: any, res: any, next: any) => {
    const { role } = req.user;
    if (!['OPERATOR', 'ADMIN', 'OWNER'].includes(role)) {
      return res.status(403).json({ 
        error: 'Acesso negado. Apenas operadores podem executar esta ação.' 
      });
    }
    next();
  };

  // ==========================================
  // ROTAS DE ALTERAÇÕES PENDENTES
  // ==========================================

  /**
   * GET /production/pending-changes
   * Lista alterações pendentes da organização
   */
  router.get('/pending-changes', async (req: any, res) => {
    try {
      const { organizationId } = req.user;
      const { 
        status, 
        priority, 
        orderId, 
        requestedBy, 
        page = 1, 
        limit = 50,
        dateFrom,
        dateTo
      } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (orderId) filters.orderId = orderId;
      if (requestedBy) filters.requestedBy = requestedBy;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);

      const result = await pendingChangesService.findByOrganization(
        organizationId,
        filters,
        parseInt(page),
        parseInt(limit)
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching pending changes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /production/pending-changes/:id
   * Obtém detalhes de uma alteração pendente
   */
  router.get('/pending-changes/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req.user;

      const pendingChange = await pendingChangesRepository.findById(id);
      
      if (!pendingChange) {
        return res.status(404).json({ error: 'Alteração pendente não encontrada' });
      }

      if (pendingChange.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Analisar as alterações para exibição
      const changes = pendingChangesService.analyzeChanges(pendingChange);

      res.json({
        ...pendingChange,
        analyzedChanges: changes
      });
    } catch (error) {
      console.error('Error fetching pending change:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * POST /production/pending-changes/:id/approve
   * Aprova uma alteração pendente
   */
  router.post('/pending-changes/:id/approve', operatorAuthMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const { userId, organizationId } = req.user;

      // Verificar se a alteração existe e pertence à organização
      const existingChange = await pendingChangesRepository.findById(id);
      if (!existingChange) {
        return res.status(404).json({ error: 'Alteração pendente não encontrada' });
      }

      if (existingChange.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const updatedChange = await pendingChangesService.approveChange({
        pendingChangeId: id,
        reviewedBy: userId,
        comments
      });

      res.json({
        success: true,
        message: 'Alteração aprovada com sucesso',
        pendingChange: updatedChange
      });
    } catch (error) {
      console.error('Error approving change:', error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * POST /production/pending-changes/:id/reject
   * Rejeita uma alteração pendente
   */
  router.post('/pending-changes/:id/reject', operatorAuthMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const { userId, organizationId } = req.user;

      if (!comments || comments.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Comentário é obrigatório para rejeição de alterações' 
        });
      }

      // Verificar se a alteração existe e pertence à organização
      const existingChange = await pendingChangesRepository.findById(id);
      if (!existingChange) {
        return res.status(404).json({ error: 'Alteração pendente não encontrada' });
      }

      if (existingChange.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const updatedChange = await pendingChangesService.rejectChange({
        pendingChangeId: id,
        reviewedBy: userId,
        comments: comments.trim()
      });

      res.json({
        success: true,
        message: 'Alteração rejeitada',
        pendingChange: updatedChange
      });
    } catch (error) {
      console.error('Error rejecting change:', error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /production/orders/:orderId/pending-changes
   * Lista alterações pendentes de um pedido específico
   */
  router.get('/orders/:orderId/pending-changes', async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { organizationId } = req.user;

      // Verificar se o pedido pertence à organização
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { organizationId: true }
      });

      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      if (order.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const pendingChanges = await pendingChangesService.findByOrder(orderId);

      res.json(pendingChanges);
    } catch (error) {
      console.error('Error fetching order pending changes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /production/orders/:orderId/has-pending-changes
   * Verifica se um pedido tem alterações pendentes
   */
  router.get('/orders/:orderId/has-pending-changes', async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { organizationId } = req.user;

      // Verificar se o pedido pertence à organização
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { organizationId: true }
      });

      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      if (order.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const hasPendingChanges = await pendingChangesService.hasOrderPendingChanges(orderId);

      res.json({ hasPendingChanges });
    } catch (error) {
      console.error('Error checking pending changes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // ROTAS DE NOTIFICAÇÕES
  // ==========================================

  /**
   * GET /production/notifications
   * Lista notificações do usuário
   */
  router.get('/notifications', async (req: any, res) => {
    try {
      const { organizationId, userId } = req.user;
      const { 
        type, 
        unreadOnly = 'false', 
        page = 1, 
        limit = 50,
        dateFrom,
        dateTo
      } = req.query;

      const filters: any = {};
      if (type) filters.type = type;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);

      const result = await notificationService.getUserNotifications(
        organizationId,
        userId,
        parseInt(page),
        parseInt(limit),
        unreadOnly === 'true'
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * POST /production/notifications/:id/read
   * Marca notificação como lida
   */
  router.post('/notifications/:id/read', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId, organizationId } = req.user;

      // Verificar se a notificação existe e pertence ao usuário/organização
      const notification = await notificationRepository.findById(id);
      if (!notification) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      if (notification.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (notification.userId && notification.userId !== userId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      await notificationService.markAsRead(id, userId);

      res.json({ success: true, message: 'Notificação marcada como lida' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * POST /production/notifications/read-all
   * Marca todas as notificações como lidas
   */
  router.post('/notifications/read-all', async (req: any, res) => {
    try {
      const { organizationId, userId } = req.user;

      const count = await notificationService.markAllAsRead(organizationId, userId);

      res.json({ 
        success: true, 
        message: `${count} notificações marcadas como lidas`,
        count 
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /production/notifications/unread-count
   * Obtém contagem de notificações não lidas
   */
  router.get('/notifications/unread-count', async (req: any, res) => {
    try {
      const { organizationId, userId } = req.user;

      const count = await notificationService.getUnreadCount(organizationId, userId);

      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // ROTAS DE ESTATÍSTICAS
  // ==========================================

  /**
   * GET /production/stats
   * Obtém estatísticas de produção
   */
  router.get('/stats', operatorAuthMiddleware, async (req: any, res) => {
    try {
      const { organizationId } = req.user;

      const [pendingChangesStats, notificationStats] = await Promise.all([
        pendingChangesService.getStats(organizationId),
        notificationService.getOrganizationStats(organizationId)
      ]);

      res.json({
        pendingChanges: pendingChangesStats,
        notifications: notificationStats
      });
    } catch (error) {
      console.error('Error fetching production stats:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /production/websocket/status
   * Verifica status das conexões WebSocket
   */
  router.get('/websocket/status', operatorAuthMiddleware, async (req: any, res) => {
    try {
      const { organizationId } = req.user;

      const connectivity = await notificationService.testWebSocketConnectivity(organizationId);
      const stats = websocketServer.getStats();

      res.json({
        organization: connectivity,
        global: stats
      });
    } catch (error) {
      console.error('Error checking WebSocket status:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // ROTAS DE MANUTENÇÃO
  // ==========================================

  /**
   * POST /production/cleanup
   * Limpa dados antigos (apenas para admins)
   */
  router.post('/cleanup', async (req: any, res) => {
    try {
      const { organizationId, role } = req.user;
      
      if (!['ADMIN', 'OWNER'].includes(role)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const { daysOld = 90 } = req.body;

      const [cleanedChanges, cleanedNotifications] = await Promise.all([
        pendingChangesService.cleanupOldChanges(organizationId, daysOld),
        notificationService.cleanupOldNotifications(organizationId, daysOld)
      ]);

      res.json({
        success: true,
        message: 'Limpeza concluída',
        cleaned: {
          pendingChanges: cleanedChanges,
          notifications: cleanedNotifications
        }
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
}

export default createProductionRoutes;
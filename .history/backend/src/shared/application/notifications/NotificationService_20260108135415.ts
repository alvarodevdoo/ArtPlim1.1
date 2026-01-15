import { NotificationRepository, NotificationWithUser, CreateNotificationData } from '../../../modules/production/repositories/NotificationRepository';
import { PendingChangeWithRelations } from '../../../modules/production/repositories/PendingChangesRepository';
import { WebSocketServer } from '../../infrastructure/websocket/WebSocketServer';
import { PrismaClient } from '@prisma/client';

export interface NotificationServiceConfig {
  enableEmailNotifications?: boolean;
  enablePushNotifications?: boolean;
  enableWebSocketNotifications?: boolean;
}

export class NotificationService {
  private config: NotificationServiceConfig;

  constructor(
    private notificationRepository: NotificationRepository,
    private websocketServer: WebSocketServer,
    private prisma: PrismaClient,
    config: NotificationServiceConfig = {}
  ) {
    this.config = {
      enableEmailNotifications: false, // Implementar futuramente
      enablePushNotifications: false,  // Implementar futuramente
      enableWebSocketNotifications: true,
      ...config
    };
  }

  /**
   * Notifica sobre uma nova solicitação de alteração
   */
  async notifyChangeRequest(pendingChange: PendingChangeWithRelations): Promise<void> {
    try {
      // Criar notificação no banco
      const notification = await this.notificationRepository.createChangeRequestNotification(
        pendingChange.organizationId,
        pendingChange.orderId,
        pendingChange.order.orderNumber,
        pendingChange.requestedByUser.name,
        pendingChange.id
      );

      // Enviar via WebSocket para operadores e admins
      if (this.config.enableWebSocketNotifications) {
        this.websocketServer.notifyByRole(
          pendingChange.organizationId,
          ['OPERATOR', 'ADMIN', 'OWNER'],
          'change-request',
          {
            notification,
            pendingChange: this.sanitizePendingChange(pendingChange)
          }
        );
      }

      console.log(`📢 Change request notification sent for order ${pendingChange.order.orderNumber}`);
    } catch (error) {
      console.error('Error sending change request notification:', error);
      throw error;
    }
  }

  /**
   * Notifica sobre a decisão de uma alteração (aprovada/rejeitada)
   */
  async notifyChangeDecision(
    pendingChange: PendingChangeWithRelations,
    approved: boolean,
    reviewedByName: string,
    comments?: string
  ): Promise<void> {
    try {
      // Criar notificação no banco para o solicitante
      const notification = await this.notificationRepository.createChangeDecisionNotification(
        pendingChange.organizationId,
        pendingChange.requestedBy,
        pendingChange.orderId,
        pendingChange.order.orderNumber,
        approved,
        reviewedByName,
        pendingChange.id,
        comments
      );

      // Enviar via WebSocket para o solicitante
      if (this.config.enableWebSocketNotifications) {
        this.websocketServer.notifyUser(
          pendingChange.requestedBy,
          'change-decision',
          {
            notification,
            pendingChange: this.sanitizePendingChange(pendingChange),
            approved,
            comments
          }
        );

        // Também notificar outros operadores sobre a decisão
        this.websocketServer.notifyByRole(
          pendingChange.organizationId,
          ['OPERATOR', 'ADMIN', 'OWNER'],
          'change-decision-broadcast',
          {
            orderId: pendingChange.orderId,
            orderNumber: pendingChange.order.orderNumber,
            approved,
            reviewedBy: reviewedByName,
            pendingChangeId: pendingChange.id
          }
        );
      }

      console.log(`📢 Change decision notification sent for order ${pendingChange.order.orderNumber}: ${approved ? 'APPROVED' : 'REJECTED'}`);
    } catch (error) {
      console.error('Error sending change decision notification:', error);
      throw error;
    }
  }

  /**
   * Cria uma notificação personalizada
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationWithUser> {
    try {
      const notification = await this.notificationRepository.create(data);

      // Enviar via WebSocket
      if (this.config.enableWebSocketNotifications) {
        if (data.userId) {
          // Notificação para usuário específico
          this.websocketServer.notifyUser(data.userId, 'notification', notification);
        } else {
          // Notificação geral para organização
          this.websocketServer.notifyOrganization(data.organizationId, 'notification', notification);
        }
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationWithUser> {
    try {
      const notification = await this.notificationRepository.markAsRead(notificationId);

      // Notificar via WebSocket sobre a atualização
      if (this.config.enableWebSocketNotifications) {
        this.websocketServer.notifyUser(userId, 'notification-read', {
          notificationId,
          read: true
        });
      }

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Marca todas as notificações como lidas para um usuário
   */
  async markAllAsRead(organizationId: string, userId: string): Promise<number> {
    try {
      const count = await this.notificationRepository.markAllAsRead(organizationId, userId);

      // Notificar via WebSocket
      if (this.config.enableWebSocketNotifications) {
        this.websocketServer.notifyUser(userId, 'all-notifications-read', {
          count
        });
      }

      return count;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Obtém notificações de um usuário
   */
  async getUserNotifications(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
    unreadOnly: boolean = false
  ) {
    return this.notificationRepository.findByUser(
      organizationId,
      userId,
      { read: unreadOnly ? false : undefined },
      page,
      limit
    );
  }

  /**
   * Obtém contagem de notificações não lidas
   */
  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(organizationId, userId);
  }

  /**
   * Obtém estatísticas de notificações da organização
   */
  async getOrganizationStats(organizationId: string) {
    return this.notificationRepository.getStatsByOrganization(organizationId);
  }

  /**
   * Limpa notificações antigas
   */
  async cleanupOldNotifications(organizationId: string, daysOld: number = 30): Promise<number> {
    return this.notificationRepository.cleanupOldNotifications(organizationId, daysOld);
  }

  /**
   * Envia notificação de sistema para toda a organização
   */
  async sendSystemNotification(
    organizationId: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      // Buscar todos os usuários da organização
      const users = await this.prisma.user.findMany({
        where: { organizationId, active: true },
        select: { id: true }
      });

      // Criar notificações para todos os usuários
      const notifications = users.map(user => ({
        organizationId,
        userId: user.id,
        type: 'CHANGE_REQUEST' as const, // Usar um tipo genérico por enquanto
        title,
        message,
        data
      }));

      await this.notificationRepository.createBulk(notifications);

      // Enviar via WebSocket
      if (this.config.enableWebSocketNotifications) {
        this.websocketServer.notifyOrganization(organizationId, 'system-notification', {
          title,
          message,
          data
        });
      }

      console.log(`📢 System notification sent to ${users.length} users in organization ${organizationId}`);
    } catch (error) {
      console.error('Error sending system notification:', error);
      throw error;
    }
  }

  /**
   * Verifica se há muitas solicitações pendentes e alerta
   */
  async checkPendingChangesThreshold(organizationId: string, threshold: number = 10): Promise<void> {
    try {
      const pendingCount = await this.prisma.pendingChanges.count({
        where: {
          organizationId,
          status: 'PENDING'
        }
      });

      if (pendingCount >= threshold) {
        await this.sendSystemNotification(
          organizationId,
          'Muitas alterações pendentes',
          `Existem ${pendingCount} alterações aguardando aprovação. Considere revisar as solicitações.`,
          { pendingCount, threshold }
        );
      }
    } catch (error) {
      console.error('Error checking pending changes threshold:', error);
    }
  }

  /**
   * Remove dados sensíveis do objeto PendingChange para envio via WebSocket
   */
  private sanitizePendingChange(pendingChange: PendingChangeWithRelations) {
    return {
      id: pendingChange.id,
      orderId: pendingChange.orderId,
      status: pendingChange.status,
      priority: pendingChange.priority,
      requestedAt: pendingChange.requestedAt,
      reviewedAt: pendingChange.reviewedAt,
      reviewComments: pendingChange.reviewComments,
      order: {
        orderNumber: pendingChange.order.orderNumber,
        status: pendingChange.order.status,
        customer: {
          name: pendingChange.order.customer.name
        }
      },
      requestedByUser: {
        name: pendingChange.requestedByUser.name
      },
      reviewedByUser: pendingChange.reviewedByUser ? {
        name: pendingChange.reviewedByUser.name
      } : null,
      // Não incluir 'changes' e 'originalData' por segurança
      hasChanges: !!pendingChange.changes
    };
  }

  /**
   * Testa conectividade WebSocket
   */
  async testWebSocketConnectivity(organizationId: string): Promise<{
    connectedUsers: string[];
    totalConnections: number;
  }> {
    const connectedUsers = this.websocketServer.getOrganizationConnectedUsers(organizationId);
    const stats = this.websocketServer.getStats();
    
    return {
      connectedUsers,
      totalConnections: stats.totalConnections
    };
  }
}

export default NotificationService;
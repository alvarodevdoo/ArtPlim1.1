import { PrismaClient, Notifications, NotificationType } from '@prisma/client';

export interface NotificationWithUser extends Notifications {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateNotificationData {
  organizationId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export interface NotificationFilters {
  userId?: string;
  type?: NotificationType;
  read?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNotificationData): Promise<NotificationWithUser> {
    return this.prisma.notifications.create({
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async createBulk(notifications: CreateNotificationData[]): Promise<number> {
    const result = await this.prisma.notifications.createMany({
      data: notifications
    });
    return result.count;
  }

  async findById(id: string): Promise<NotificationWithUser | null> {
    return this.prisma.notifications.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async findByOrganization(
    organizationId: string,
    filters: NotificationFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: NotificationWithUser[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = {
      organizationId,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.read !== undefined && { read: filters.read }),
      ...(filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo })
        }
      }
    };

    const [data, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.notifications.count({ where })
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByUser(
    organizationId: string,
    userId: string,
    filters: Omit<NotificationFilters, 'userId'> = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: NotificationWithUser[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
  }> {
    const where: any = {
      organizationId,
      OR: [
        { userId: userId },
        { userId: null } // Notificações gerais
      ],
      ...(filters.type && { type: filters.type }),
      ...(filters.read !== undefined && { read: filters.read }),
      ...(filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo })
        }
      }
    };

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({
        where: {
          organizationId,
          OR: [
            { userId: userId },
            { userId: null }
          ],
          read: false
        }
      })
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount
    };
  }

  async markAsRead(id: string): Promise<NotificationWithUser> {
    return this.prisma.notifications.update({
      where: { id },
      data: { read: true },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async markAllAsRead(organizationId: string, userId: string): Promise<number> {
    const result = await this.prisma.notifications.updateMany({
      where: {
        organizationId,
        OR: [
          { userId: userId },
          { userId: null }
        ],
        read: false
      },
      data: { read: true }
    });

    return result.count;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notifications.delete({
      where: { id }
    });
  }

  async deleteMany(ids: string[]): Promise<number> {
    const result = await this.prisma.notifications.deleteMany({
      where: { id: { in: ids } }
    });
    return result.count;
  }

  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    return this.prisma.notifications.count({
      where: {
        organizationId,
        OR: [
          { userId: userId },
          { userId: null }
        ],
        read: false
      }
    });
  }

  async getStatsByOrganization(organizationId: string): Promise<{
    total: number;
    unread: number;
    byType: {
      changeRequest: number;
      changeApproved: number;
      changeRejected: number;
    };
    last24Hours: number;
  }> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const [total, unread, changeRequest, changeApproved, changeRejected, recent] = await Promise.all([
      this.prisma.notifications.count({ where: { organizationId } }),
      this.prisma.notifications.count({ where: { organizationId, read: false } }),
      this.prisma.notifications.count({ where: { organizationId, type: 'CHANGE_REQUEST' } }),
      this.prisma.notifications.count({ where: { organizationId, type: 'CHANGE_APPROVED' } }),
      this.prisma.notifications.count({ where: { organizationId, type: 'CHANGE_REJECTED' } }),
      this.prisma.notifications.count({ where: { organizationId, createdAt: { gte: last24Hours } } })
    ]);

    return {
      total,
      unread,
      byType: {
        changeRequest,
        changeApproved,
        changeRejected
      },
      last24Hours: recent
    };
  }

  async cleanupOldNotifications(organizationId: string, daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notifications.deleteMany({
      where: {
        organizationId,
        read: true,
        createdAt: { lt: cutoffDate }
      }
    });

    return result.count;
  }

  async findRecentByType(
    organizationId: string,
    type: NotificationType,
    hours: number = 1
  ): Promise<NotificationWithUser[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return this.prisma.notifications.findMany({
      where: {
        organizationId,
        type,
        createdAt: { gte: cutoffDate }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserNotificationPreferences(userId: string): Promise<{
    emailNotifications: boolean;
    pushNotifications: boolean;
    soundNotifications: boolean;
  }> {
    // Por enquanto, retorna configurações padrão
    // No futuro, isso pode vir de uma tabela de preferências do usuário
    return {
      emailNotifications: true,
      pushNotifications: true,
      soundNotifications: true
    };
  }

  async createChangeRequestNotification(
    organizationId: string,
    orderId: string,
    orderNumber: string,
    requestedByName: string,
    pendingChangeId: string
  ): Promise<NotificationWithUser> {
    return this.create({
      organizationId,
      type: 'CHANGE_REQUEST',
      title: `Alteração solicitada - Pedido #${orderNumber}`,
      message: `${requestedByName} solicitou alteração no pedido`,
      data: {
        orderId,
        orderNumber,
        pendingChangeId,
        requestedBy: requestedByName
      }
    });
  }

  async createChangeDecisionNotification(
    organizationId: string,
    userId: string,
    orderId: string,
    orderNumber: string,
    approved: boolean,
    reviewedByName: string,
    pendingChangeId: string,
    comments?: string
  ): Promise<NotificationWithUser> {
    return this.create({
      organizationId,
      userId,
      type: approved ? 'CHANGE_APPROVED' : 'CHANGE_REJECTED',
      title: `Alteração ${approved ? 'aprovada' : 'rejeitada'} - Pedido #${orderNumber}`,
      message: `Sua solicitação foi ${approved ? 'aprovada' : 'rejeitada'} por ${reviewedByName}`,
      data: {
        orderId,
        orderNumber,
        pendingChangeId,
        approved,
        reviewedBy: reviewedByName,
        comments
      }
    });
  }
}

export default NotificationRepository;
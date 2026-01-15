import { PrismaClient, PendingChanges, PendingChangeStatus, PendingChangePriority } from '@prisma/client';

export interface PendingChangeWithRelations extends PendingChanges {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customer: {
      name: string;
    };
  };
  requestedByUser: {
    id: string;
    name: string;
    email: string;
  };
  reviewedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreatePendingChangeData {
  orderId: string;
  organizationId: string;
  requestedBy: string;
  changes: any;
  originalData: any;
  priority?: PendingChangePriority;
}

export interface UpdatePendingChangeData {
  status?: PendingChangeStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
}

export interface PendingChangeFilters {
  status?: PendingChangeStatus;
  priority?: PendingChangePriority;
  orderId?: string;
  requestedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class PendingChangesRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePendingChangeData): Promise<PendingChangeWithRelations> {
    return this.prisma.pendingChanges.create({
      data: {
        ...data,
        requestedAt: new Date(),
      },
      include: {
        order: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        },
        requestedByUser: {
          select: { id: true, name: true, email: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async findById(id: string): Promise<PendingChangeWithRelations | null> {
    return this.prisma.pendingChanges.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        },
        requestedByUser: {
          select: { id: true, name: true, email: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async findByOrganization(
    organizationId: string,
    filters: PendingChangeFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: PendingChangeWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = {
      organizationId,
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.orderId && { orderId: filters.orderId }),
      ...(filters.requestedBy && { requestedBy: filters.requestedBy }),
      ...(filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo })
        }
      }
    };

    const [data, total] = await Promise.all([
      this.prisma.pendingChanges.findMany({
        where,
        include: {
          order: {
            include: {
              customer: {
                select: { name: true }
              }
            }
          },
          requestedByUser: {
            select: { id: true, name: true, email: true }
          },
          reviewedByUser: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.pendingChanges.count({ where })
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByOrder(orderId: string): Promise<PendingChangeWithRelations[]> {
    return this.prisma.pendingChanges.findMany({
      where: { orderId },
      include: {
        order: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        },
        requestedByUser: {
          select: { id: true, name: true, email: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findPendingByOrder(orderId: string): Promise<PendingChangeWithRelations[]> {
    return this.prisma.pendingChanges.findMany({
      where: { 
        orderId,
        status: 'PENDING'
      },
      include: {
        order: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        },
        requestedByUser: {
          select: { id: true, name: true, email: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: UpdatePendingChangeData): Promise<PendingChangeWithRelations> {
    return this.prisma.pendingChanges.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        order: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        },
        requestedByUser: {
          select: { id: true, name: true, email: true }
        },
        reviewedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.pendingChanges.delete({
      where: { id }
    });
  }

  async getStatsByOrganization(organizationId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
  }> {
    const [total, pending, approved, rejected, high, medium, low] = await Promise.all([
      this.prisma.pendingChanges.count({ where: { organizationId } }),
      this.prisma.pendingChanges.count({ where: { organizationId, status: 'PENDING' } }),
      this.prisma.pendingChanges.count({ where: { organizationId, status: 'APPROVED' } }),
      this.prisma.pendingChanges.count({ where: { organizationId, status: 'REJECTED' } }),
      this.prisma.pendingChanges.count({ where: { organizationId, priority: 'HIGH' } }),
      this.prisma.pendingChanges.count({ where: { organizationId, priority: 'MEDIUM' } }),
      this.prisma.pendingChanges.count({ where: { organizationId, priority: 'LOW' } })
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      byPriority: {
        high,
        medium,
        low
      }
    };
  }

  async cleanupOldChanges(organizationId: string, daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.pendingChanges.deleteMany({
      where: {
        organizationId,
        status: { in: ['APPROVED', 'REJECTED'] },
        updatedAt: { lt: cutoffDate }
      }
    });

    return result.count;
  }

  async hasOrderPendingChanges(orderId: string): Promise<boolean> {
    const count = await this.prisma.pendingChanges.count({
      where: {
        orderId,
        status: 'PENDING'
      }
    });

    return count > 0;
  }

  async getAverageApprovalTime(organizationId: string, days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const approvedChanges = await this.prisma.pendingChanges.findMany({
      where: {
        organizationId,
        status: 'APPROVED',
        reviewedAt: { gte: cutoffDate }
      },
      select: {
        requestedAt: true,
        reviewedAt: true
      }
    });

    if (approvedChanges.length === 0) return 0;

    const totalMinutes = approvedChanges.reduce((sum, change) => {
      if (change.reviewedAt) {
        const diffMs = change.reviewedAt.getTime() - change.requestedAt.getTime();
        return sum + (diffMs / (1000 * 60)); // Convert to minutes
      }
      return sum;
    }, 0);

    return Math.round(totalMinutes / approvedChanges.length);
  }
}

export default PendingChangesRepository;
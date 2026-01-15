import { ProductionStatus } from '@prisma/client';
import { NotFoundError } from '../../../@core/errors/AppError';

interface CreateProductionInput {
  orderId: string;
  priority: number;
  scheduledStart?: string;
  estimatedEnd?: string;
  machineId?: string;
  assignedTo?: string;
  notes?: string;
}

interface UpdateProductionInput {
  priority?: number;
  status?: ProductionStatus;
  scheduledStart?: string;
  actualStart?: string;
  estimatedEnd?: string;
  actualEnd?: string;
  assignedTo?: string;
  machineId?: string;
  notes?: string;
}

interface QueueFilters {
  status?: ProductionStatus;
  priority?: number;
  machineId?: string;
  assignedTo?: string;
}

export class ProductionService {
  constructor(private prisma: any) {}

  async addToQueue(data: CreateProductionInput) {
    // Verificar se o pedido existe e está aprovado
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        customer: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundError('Pedido');
    }

    if (order.status !== 'APPROVED') {
      throw new Error('Apenas pedidos aprovados podem entrar na fila de produção');
    }

    // Verificar se já existe na fila
    const existingProduction = await this.prisma.productionQueue.findFirst({
      where: { orderId: data.orderId }
    });

    if (existingProduction) {
      throw new Error('Pedido já está na fila de produção');
    }

    const production = await this.prisma.productionQueue.create({
      data: {
        orderId: data.orderId,
        priority: data.priority,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        estimatedEnd: data.estimatedEnd ? new Date(data.estimatedEnd) : null,
        machineId: data.machineId,
        assignedTo: data.assignedTo,
        notes: data.notes
      },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                name: true
              }
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Atualizar status do pedido
    await this.prisma.order.update({
      where: { id: data.orderId },
      data: { status: 'IN_PRODUCTION' }
    });

    return production;
  }

  async getQueue(filters: QueueFilters = {}) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.machineId) {
      where.machineId = filters.machineId;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    return this.prisma.productionQueue.findMany({
      where,
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                name: true
              }
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        operations: {
          orderBy: {
            sequence: 'asc'
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async updateQueue(id: string, data: UpdateProductionInput) {
    const production = await this.prisma.productionQueue.update({
      where: { id },
      data: {
        ...data,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
        actualStart: data.actualStart ? new Date(data.actualStart) : undefined,
        estimatedEnd: data.estimatedEnd ? new Date(data.estimatedEnd) : undefined,
        actualEnd: data.actualEnd ? new Date(data.actualEnd) : undefined,
        updatedAt: new Date()
      },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    return production;
  }

  async startProduction(id: string) {
    const production = await this.prisma.productionQueue.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
        updatedAt: new Date()
      },
      include: {
        order: true
      }
    });

    return production;
  }

  async pauseProduction(id: string) {
    const production = await this.prisma.productionQueue.update({
      where: { id },
      data: {
        status: 'PAUSED',
        updatedAt: new Date()
      }
    });

    return production;
  }

  async completeProduction(id: string) {
    const production = await this.prisma.productionQueue.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!production) {
      throw new NotFoundError('Item de produção');
    }

    // Atualizar produção e pedido em transação
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Finalizar produção
      const updatedProduction = await tx.productionQueue.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualEnd: new Date(),
          updatedAt: new Date()
        }
      });

      // Atualizar status do pedido
      await tx.order.update({
        where: { id: production.orderId },
        data: { status: 'FINISHED' }
      });

      return updatedProduction;
    });

    return result;
  }

  async getDashboard() {
    const [
      totalInQueue,
      inProgress,
      completed,
      paused,
      availableMachines,
      busyMachines
    ] = await Promise.all([
      this.prisma.productionQueue.count({
        where: { status: 'PENDING' }
      }),
      this.prisma.productionQueue.count({
        where: { status: 'IN_PROGRESS' }
      }),
      this.prisma.productionQueue.count({
        where: { 
          status: 'COMPLETED',
          actualEnd: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)) // Hoje
          }
        }
      }),
      this.prisma.productionQueue.count({
        where: { status: 'PAUSED' }
      }),
      this.prisma.machine.count({
        where: { 
          status: 'AVAILABLE',
          active: true
        }
      }),
      this.prisma.machine.count({
        where: { 
          status: 'IN_USE',
          active: true
        }
      })
    ]);

    return {
      queue: {
        total: totalInQueue,
        inProgress,
        completed,
        paused
      },
      machines: {
        available: availableMachines,
        busy: busyMachines,
        total: availableMachines + busyMachines
      }
    };
  }

  async getEfficiencyReport(filters: {
    startDate?: string;
    endDate?: string;
    machineId?: string;
  } = {}) {
    const where: any = {
      status: 'COMPLETED'
    };

    if (filters.startDate || filters.endDate) {
      where.actualEnd = {};
      if (filters.startDate) {
        where.actualEnd.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.actualEnd.lte = new Date(filters.endDate);
      }
    }

    if (filters.machineId) {
      where.machineId = filters.machineId;
    }

    const completedProductions = await this.prisma.productionQueue.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true
          }
        }
      }
    });

    // Calcular métricas
    const totalProductions = completedProductions.length;
    const totalValue = completedProductions.reduce((sum: number, prod: any) => sum + Number(prod.order.total), 0);
    
    let totalEstimatedTime = 0;
    let totalActualTime = 0;
    let onTimeDeliveries = 0;

    completedProductions.forEach((prod: any) => {
      if (prod.scheduledStart && prod.estimatedEnd && prod.actualStart && prod.actualEnd) {
        const estimatedTime = new Date(prod.estimatedEnd).getTime() - new Date(prod.scheduledStart).getTime();
        const actualTime = new Date(prod.actualEnd).getTime() - new Date(prod.actualStart).getTime();
        
        totalEstimatedTime += estimatedTime;
        totalActualTime += actualTime;

        if (prod.actualEnd <= prod.estimatedEnd) {
          onTimeDeliveries++;
        }
      }
    });

    const efficiency = totalEstimatedTime > 0 ? (totalEstimatedTime / totalActualTime) * 100 : 0;
    const onTimeRate = totalProductions > 0 ? (onTimeDeliveries / totalProductions) * 100 : 0;

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate
      },
      metrics: {
        totalProductions,
        totalValue,
        efficiency: Math.round(efficiency * 100) / 100,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        averageProductionTime: totalProductions > 0 ? totalActualTime / totalProductions / (1000 * 60 * 60) : 0 // em horas
      },
      productions: completedProductions
    };
  }
}
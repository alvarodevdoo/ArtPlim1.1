import { MachineType, MachineStatus } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreateMachineInput {
  name: string;
  type: MachineType;
  model?: string;
  serialNumber?: string;
  maxWidth?: number;
  maxHeight?: number;
  speedPerMinute?: number;
}

export class MachineService {
  constructor(private prisma: any) {}

  async create(data: CreateMachineInput) {
    const machine = await this.prisma.machine.create({
      data: {
        name: data.name,
        type: data.type,
        model: data.model,
        serialNumber: data.serialNumber,
        maxWidth: data.maxWidth,
        maxHeight: data.maxHeight,
        speedPerMinute: data.speedPerMinute,
        status: 'AVAILABLE'
      }
    });

    return machine;
  }

  async list() {
    return this.prisma.machine.findMany({
      where: {
        active: true
      },
      orderBy: [
        { status: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  async findById(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id }
    });

    if (!machine) {
      throw new NotFoundError('Máquina');
    }

    return machine;
  }

  async update(id: string, data: Partial<CreateMachineInput>) {
    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return machine;
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BROKEN'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Status inválido');
    }

    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        status: status as MachineStatus
      }
    });

    return machine;
  }

  async getAvailableMachines(type?: MachineType) {
    const where: any = {
      active: true,
      status: 'AVAILABLE'
    };

    if (type) {
      where.type = type;
    }

    return this.prisma.machine.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    });
  }

  async getMachineUsage(machineId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      machineId,
      status: 'COMPLETED'
    };

    if (startDate || endDate) {
      where.actualEnd = {};
      if (startDate) where.actualEnd.gte = startDate;
      if (endDate) where.actualEnd.lte = endDate;
    }

    const productions = await this.prisma.productionQueue.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true
          }
        }
      },
      orderBy: {
        actualEnd: 'desc'
      }
    });

    // Calcular tempo total de uso
    let totalUsageTime = 0;
    productions.forEach((prod: any) => {
      if (prod.actualStart && prod.actualEnd) {
        const usageTime = new Date(prod.actualEnd).getTime() - new Date(prod.actualStart).getTime();
        totalUsageTime += usageTime;
      }
    });

    return {
      totalProductions: productions.length,
      totalUsageTime: totalUsageTime / (1000 * 60 * 60), // em horas
      totalValue: productions.reduce((sum: number, prod: any) => sum + Number(prod.order.total), 0),
      productions
    };
  }

  async scheduleMaintenance(id: string, maintenanceDate: Date) {
    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        nextMaintenance: maintenanceDate,
        status: 'MAINTENANCE'
      }
    });

    return machine;
  }

  async completeMaintenance(id: string) {
    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        lastMaintenance: new Date(),
        status: 'AVAILABLE'
      }
    });

    return machine;
  }
}
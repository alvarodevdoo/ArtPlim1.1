import { PrismaClient } from '@prisma/client';

export type TaskType = 'art' | 'prod' | 'finish';

export interface AssignTaskParams {
  orderId: string;
  userId: string;
  taskType: TaskType;
  organizationId: string;
}

export class AssignTaskUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(params: AssignTaskParams) {
    const { orderId, userId, taskType, organizationId } = params;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId }
    });

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    let updateData = {};
    const now = new Date();

    switch (taskType) {
      case 'art':
        if (order.artDesignerId && order.artDesignerId !== userId) {
          throw new Error('Esta tarefa de arte já foi assumida por outro colaborador.');
        }
        // Se clicar de novo e já for o responsável, vamos permitir desatribuir (toggle)?
        // A especificação não diz, então vamos apenas assumir que se já é dele, ignora.
        updateData = { artDesignerId: userId, artAssignedAt: now };
        break;
      case 'prod':
        if (order.productionUserId && order.productionUserId !== userId) {
          throw new Error('Esta tarefa de produção já foi assumida por outro colaborador.');
        }
        updateData = { productionUserId: userId, productionAssignedAt: now };
        break;
      case 'finish':
        if (order.packagingUserId && order.packagingUserId !== userId) {
          throw new Error('Esta tarefa de acabamento já foi assumida por outro colaborador.');
        }
        updateData = { packagingUserId: userId, packagingAssignedAt: now };
        break;
      default:
        throw new Error('Tipo de tarefa inválido');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        artDesigner: { select: { id: true, name: true } },
        producer: { select: { id: true, name: true } },
        packer: { select: { id: true, name: true } }
      }
    });

    return updatedOrder;
  }
}

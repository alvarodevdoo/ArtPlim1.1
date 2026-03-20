import { PrismaClient, OrderStatus } from '@prisma/client';

export class StatusEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Atualiza o status de um pedido completo e sincroniza seus itens
   */
  async updateOrderStatus(params: {
    orderId: string;
    organizationId: string;
    newStatus?: OrderStatus;
    newProcessStatusId?: string | null;
    userId: string;
    notes?: string | null;
  }) {
    const { orderId, organizationId, newStatus, newProcessStatusId, userId, notes } = params;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { processStatus: true }
    });

    if (!order || order.organizationId !== organizationId) {
      throw new Error('Pedido não encontrado');
    }

    const updateData: any = {};
    const fromStatus = order.status;
    const fromProcessStatusId = order.processStatusId;

    // 1. Determina o novo status baseado no ProcessStatus ou no Status direto
    if (newProcessStatusId !== undefined) {
      if (newProcessStatusId) {
        const ps = await this.prisma.processStatus.findUnique({ where: { id: newProcessStatusId } });
        if (ps) {
          updateData.status = ps.mappedBehavior;
          updateData.processStatusId = newProcessStatusId;
        }
      } else {
        updateData.processStatusId = null;
        if (newStatus) updateData.status = newStatus;
      }
    } else if (newStatus) {
      updateData.status = newStatus;
    }

    // 2. Datas de controle
    if (updateData.status === 'APPROVED' && !order.approvedAt) updateData.approvedAt = new Date();
    if (updateData.status === 'IN_PRODUCTION' && !order.inProductionAt) updateData.inProductionAt = new Date();
    if (updateData.status === 'FINISHED' && !order.finishedAt) updateData.finishedAt = new Date();
    if (updateData.status === 'DELIVERED' && !order.deliveredAt) updateData.deliveredAt = new Date();

    // 3. Executa a atualização do Pedido
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    // 4. Sincroniza todos os ITENS para o novo status do pai
    if (updateData.status) {
      await this.prisma.orderItem.updateMany({
        where: { orderId },
        data: { status: updateData.status }
      });
    }

    // 5. Registra Histórico
    await (this.prisma as any).orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus: updatedOrder.status,
        fromProcessStatusId,
        toProcessStatusId: updatedOrder.processStatusId,
        userId,
        notes: notes || null
      }
    });

    return updatedOrder;
  }

  /**
   * Atualiza o status de um item específico e sincroniza o pedido pai
   */
  async updateItemStatus(params: {
    itemId: string;
    organizationId: string;
    newStatus: string;
    userId: string;
    notes?: string | null;
  }) {
    const { itemId, organizationId, newStatus, userId, notes } = params;

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, order: { organizationId } },
      include: { order: true }
    });

    if (!item) throw new Error('Item não encontrado');

    const fromStatus = item.status;

    // 1. Atualiza o Item
    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status: newStatus as OrderStatus }
    });

    // 2. Sincroniza o Pedido Pai (Logica Inteligente)
    await this.syncParentFromItems(item.orderId, userId);

    return updatedItem;
  }

  /**
   * Lógica central de agregação: Define o status do Pedido baseado nos seus itens
   */
  public async syncParentFromItems(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, processStatus: true }
    });

    if (!order || order.items.length === 0) return;

    const items = order.items;
    const activeItems = items.filter(i => i.status !== 'CANCELLED');
    let targetStatus: OrderStatus = 'DRAFT';
    
    // Se todos estiverem cancelados, o pedido vira cancelado
    if (activeItems.length === 0 && items.length > 0) {
      targetStatus = 'CANCELLED';
    } else if (activeItems.length > 0) {
      const weights: Record<string, number> = {
        'DRAFT': 1,
        'APPROVED': 2,
        'IN_PRODUCTION': 3,
        'FINISHED': 4,
        'DELIVERED': 5
      };

      // Pegar o menor peso entre os itens ativos
      const itemWeights = activeItems.map(i => weights[i.status as string] || 1);
      const minWeight = Math.min(...itemWeights);
      
      // Encontrar o status que corresponde a esse peso mínimo
      targetStatus = (Object.keys(weights).find(key => weights[key] === minWeight) as OrderStatus) || 'DRAFT';
    }

    if (order.status !== targetStatus) {
      // Tentar encontrar um ProcessStatus da organização que mapeie para esse targetStatus
      // com o menor displayOrder primeiro. Se for DRAFT e não achar nada mapeado, pega a PRIMEIRA etapa de todas.
      let matchingProcessStatus = await this.prisma.processStatus.findFirst({
        where: { 
          organizationId: order.organizationId,
          mappedBehavior: targetStatus,
          active: true
        },
        orderBy: { displayOrder: 'asc' }
      });

      // Fallback radical para DRAFT (Primeira etapa absoluta da organização)
      if (!matchingProcessStatus && targetStatus === 'DRAFT') {
        matchingProcessStatus = await this.prisma.processStatus.findFirst({
          where: { organizationId: order.organizationId, active: true },
          orderBy: { displayOrder: 'asc' }
        });
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: { 
          status: targetStatus,
          processStatusId: matchingProcessStatus?.id || null 
        }
      });

      // Logar mudança automática com nome oficial do usuário se disponível
      const friendlyStatusName = matchingProcessStatus?.name || targetStatus;
      await (this.prisma as any).orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: targetStatus,
          fromProcessStatusId: order.processStatusId,
          toProcessStatusId: matchingProcessStatus?.id || null,
          userId,
          notes: `Pedido avançou para a etapa: ${friendlyStatusName}`
        }
      });
    }
  }
}

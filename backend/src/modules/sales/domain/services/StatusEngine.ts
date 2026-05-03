import { PrismaClient, OrderStatus } from '@prisma/client';
import { OrderFinanceHelper } from '../../../../shared/utils/OrderFinanceHelper';

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
      // Garante que o ProcessStatus da UI rastreie o comportamento modificado (ex: Cancelado)
      const matchingProcessStatus = await this.prisma.processStatus.findFirst({
        where: { organizationId, mappedBehavior: newStatus, active: true },
        orderBy: { displayOrder: 'asc' }
      });
      updateData.processStatusId = matchingProcessStatus ? matchingProcessStatus.id : null;
    }

    // ── Validação de Regras de Negócio (Blindagem) ──
    // Só validamos se houver mudança REAL de status e se não for a criação inicial (fromStatus != undefined)
    if (updateData.status && fromStatus && updateData.status !== order.status) {
      console.log(`[StatusEngine] Vai disparar validação financeira -> orderId: ${orderId}, newStatus: ${updateData.status}, processStatusId: ${updateData.processStatusId}`);
      await this.validateFinanceRules(orderId, organizationId, updateData.status, updateData.processStatusId);
    }

    // 2. Datas de controle
    if (updateData.status === 'APPROVED' && !order.approvedAt) updateData.approvedAt = new Date();
    if (updateData.status === 'IN_PRODUCTION' && !order.inProductionAt) updateData.inProductionAt = new Date();
    
    if (updateData.status === 'FINISHED' && !order.finishedAt) {
      updateData.finishedAt = new Date();
      
      // Buscar a transação associada para sincronizar o Regime de Competência
      const transaction = await (this.prisma.transaction as any).findFirst({
        where: { orderId, type: 'INCOME' },
        orderBy: { createdAt: 'desc' }
      });
      
      if (transaction?.competenceDate) {
        console.log(`[StatusEngine] Sincronizando finishedAt com competenceDate da transação: ${transaction.competenceDate}`);
        updateData.finishedAt = transaction.competenceDate;
      }
    }
    
    if (updateData.status === 'DELIVERED' && !order.deliveredAt) updateData.deliveredAt = new Date();

    // 3. Executa a atualização do Pedido
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    // 4. Sincroniza todos os ITENS para o novo status do pai
    if (updateData.status) {
      const itemUpdateData: any = { status: updateData.status };

      // Se cancelou, propagar o processStatusId do cancelamento para os itens também
      if (updateData.status === 'CANCELLED' && updateData.processStatusId) {
        itemUpdateData.processStatusId = updateData.processStatusId;
      }

      await this.prisma.orderItem.updateMany({
        where: { orderId },
        data: itemUpdateData
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
      const updateData: any = { 
        status: targetStatus
      };
      
      // Datas de controle
      if (targetStatus === 'FINISHED' && !order.finishedAt) {
        updateData.finishedAt = new Date();
        
        // Buscar a transação associada para sincronizar o Regime de Competência
        const transaction = await (this.prisma.transaction as any).findFirst({
          where: { orderId, type: 'INCOME' },
          orderBy: { createdAt: 'desc' }
        });
        
        if (transaction?.competenceDate) {
          console.log(`[StatusEngine] syncParent - Sincronizando finishedAt com competenceDate da transação: ${transaction.competenceDate}`);
          updateData.finishedAt = transaction.competenceDate;
        }
      }
      
      if (targetStatus === 'DELIVERED' && !order.deliveredAt) updateData.deliveredAt = new Date();

      // Tentar encontrar um ProcessStatus da organização que mapeie para esse targetStatus
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

      updateData.processStatusId = matchingProcessStatus?.id || null;

      // ── Validação de Regras de Negócio Dinâmicas ──
      if (order.status) {
        await this.validateFinanceRules(orderId, order.organizationId, targetStatus, updateData.processStatusId);
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: updateData
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

   /**
   * Valida se um pedido atende às exigências financeiras da organização
   * para avançar para um determinado status.
   */
  public async validateFinanceRules(orderId: string, organizationId: string, targetStatus: OrderStatus, targetProcessStatusId?: string | null) {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { requireOrderDeposit: true, minDepositPercent: true, allowDeliveryWithBalance: true }
    });

    if (!settings) return;

    // Buscar as configurações da ETAPA (ProcessStatus) de destino
    let targetPS = null;
    if (targetProcessStatusId) {
      targetPS = await this.prisma.processStatus.findUnique({ where: { id: targetProcessStatusId } });
      console.log(`[StatusEngine/Finance] PS ID Fornecido: ${targetProcessStatusId}. Encontrado: ${targetPS?.name} | R.Pay: ${targetPS?.requirePayment} | R.Dep: ${targetPS?.requireDeposit}`);
    } else {
      // Fallback: busca o primeiro status que mapeia para esse comportamento
      targetPS = await this.prisma.processStatus.findFirst({
        where: { organizationId, mappedBehavior: targetStatus, active: true },
        orderBy: { displayOrder: 'asc' }
      });
      console.log(`[StatusEngine/Finance] PS ID não fornecido. Buscando fallback por status ${targetStatus}. Encontrado: ${targetPS?.name} | R.Pay: ${targetPS?.requirePayment} | R.Dep: ${targetPS?.requireDeposit}`);
    }

    // Se a etapa não exige nada, liberamos o caminho
    if (!targetPS || (!targetPS.requireDeposit && !targetPS.requirePayment)) {
      console.log(`[StatusEngine/Finance] Status livre de validação financeira. PS encontrado? ${!!targetPS}`);
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        transactions: true,
        customer: {
          select: { exemptFromDeposit: true }
        }
      }
    });

    if (!order) return;

    const totalOrder = Number(order.total || 0);
    const remainingBalance = OrderFinanceHelper.calculateRemainingBalance(order as any);
    const paidTotal = totalOrder - remainingBalance;

    // 1. Regra de Sinal (Entrada) baseada na Etapa
    if (targetPS.requireDeposit && settings.requireOrderDeposit) {
      if (order.customer?.exemptFromDeposit) {
        console.log(`[StatusEngine/Finance] Cliente isento de sinal mínimo. Ignorando validação de depósito.`);
      } else {
        const minPercent = Number(settings.minDepositPercent || 0);
        
        // EXCEÇÃO: Se o pedido não tiver nenhuma transação ainda mas a regra global permitir aprovação sem depósito 
        // (ajuda no fluxo de criação), mas aqui respeitamos a flag da ETAPA.
        if (order.transactions && order.transactions.length === 0) {
          console.log(`[StatusEngine] Validando aprovação inicial sem transações para a etapa ${targetPS.name}`);
        }

        const paidPercent = (paidTotal / totalOrder) * 100;

        if (paidPercent < minPercent) {
          const requiredValue = totalOrder * (minPercent / 100);
          console.error(`[StatusEngine/Finance] 🚫 BLOQUEADO POR SINAL! Exige: ${minPercent}%, Pago: ${paidPercent}%`);
          throw new Error(`PAYMENT_REQUIRED:SINAL|A etapa "${targetPS.name}" exige um sinal mínimo de ${minPercent}% (${OrderFinanceHelper.formatCurrency(requiredValue)}). Pago: ${paidPercent.toFixed(1)}%`);
        }
      }
    }

    // 2. Regra de Quitação baseada na Etapa
    if (targetPS.requirePayment && !settings.allowDeliveryWithBalance) {
      if (remainingBalance >= 0.01) {
        console.error(`[StatusEngine/Finance] 🚫 BLOQUEADO POR QUITAÇÃO TOTAL! Saldo devedor: ${remainingBalance}`);
        throw new Error(`PAYMENT_REQUIRED:TOTAL|A etapa "${targetPS.name}" não permite avanço com saldo em aberto. Realize a quitação total de ${OrderFinanceHelper.formatCurrency(remainingBalance)} para prosseguir.`);
      }
    }
  }
}

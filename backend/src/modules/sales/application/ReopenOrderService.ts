/**
 * ReopenOrderService
 *
 * Responsabilidade: Reverter o status de um pedido para o estado imediatamente anterior,
 * usando o histórico de status (OrderStatusHistory).
 *
 * CASOS DE USO:
 * - Pedido marcado como FINISHED por acidente → volta para APPROVED (ou status anterior)
 * - Pedido marcado como DELIVERED por acidente → volta para FINISHED
 *
 * SEM impacto financeiro ou de estoque (é apenas uma correção de status).
 */

export interface ReopenOrderInput {
  orderId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}

export class ReopenOrderService {
  constructor(private readonly prisma: any) {}

  async execute(input: ReopenOrderInput): Promise<any> {
    const { orderId, organizationId, userId, reason } = input;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId }
    });

    if (!order) throw new Error('Pedido não encontrado.');

    if (order.status === 'DRAFT') {
      throw new Error('Este pedido já está em Rascunho e não pode ser reaberto.');
    }

    // Buscar o registro imediatamente ANTERIOR no histórico de status
    const lastHistoryEntry = await this.prisma.orderStatusHistory.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastHistoryEntry?.fromStatus) {
      throw new Error('Não foi possível determinar o status anterior deste pedido. O histórico pode estar incompleto.');
    }

    const previousStatus = lastHistoryEntry.fromStatus;
    const currentStatus = order.status;

    // Montar os campos a limpar com base no status que está sendo desfeito
    const dataToReset: any = {
      status: previousStatus,
      updatedAt: new Date()
    };

    // Se estamos desfazendo uma Finalização, limpamos o finishedAt
    if (currentStatus === 'FINISHED' || currentStatus === 'DELIVERED') {
      dataToReset.finishedAt = null;
    }

    // Se estamos desfazendo uma Aprovação, limpamos o approvedAt
    if (currentStatus === 'APPROVED') {
      dataToReset.approvedAt = null;
    }

    await this.prisma.$transaction(async (tx: any) => {
      // 1. Reverter o status
      await tx.order.update({
        where: { id: orderId },
        data: dataToReset
      });

      // 2. Registrar no histórico com justificativa
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentStatus,
          toStatus: previousStatus,
          notes: `Reabertura manual. Motivo: ${reason || 'Não informado.'}`,
          userId
        }
      });
    });

    // Retornar pedido completo para o frontend atualizar imediatamente
    return await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
        processStatus: true,
        transactions: true,
        accountsReceivable: true
      }
    });
  }
}

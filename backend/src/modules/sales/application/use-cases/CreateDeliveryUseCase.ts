import { OrderStatus, DeliveryStatus } from '@prisma/client';
import { AppError, NotFoundError } from '../../../../shared/infrastructure/errors/AppError';

export interface CreateDeliveryInput {
  orderId: string;
  organizationId: string;
  userId: string;
  notes?: string;
  items: {
    orderItemId: string;
    quantity: number;
  }[];
}

export class CreateDeliveryUseCase {
  constructor(private prisma: any) {}

  async execute(input: CreateDeliveryInput) {
    const { orderId, organizationId, userId, notes, items } = input;

    if (!items || items.length === 0) {
      throw new AppError('O romaneio deve conter pelo menos um item.', 400);
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Buscar Pedido com seus itens e itens já entregues em outros romaneios
      const order = await tx.order.findUnique({
        where: { id: orderId, organizationId },
        include: {
          items: true,
          deliveries: {
            where: { status: { not: DeliveryStatus.CANCELLED } },
            include: { items: true }
          }
        }
      });

      if (!order) {
        throw new NotFoundError('Pedido');
      }

      // 2. Map de quantidades já entregues por item
      const deliveredQuantities = new Map<string, number>();
      for (const delivery of order.deliveries) {
        for (const dItem of delivery.items) {
          const current = deliveredQuantities.get(dItem.orderItemId) || 0;
          deliveredQuantities.set(dItem.orderItemId, current + dItem.quantity);
        }
      }

      // 3. Validar itens a serem entregues
      const validItemsToDeliver = [];

      for (const reqItem of items) {
        if (reqItem.quantity <= 0) continue;

        const orderItem = order.items.find((i: any) => i.id === reqItem.orderItemId);
        
        if (!orderItem) {
          throw new AppError(`Item do pedido (${reqItem.orderItemId}) não encontrado.`, 400);
        }

        if (orderItem.status === OrderStatus.CANCELLED) {
          throw new AppError(`Não é possível entregar o item "${orderItem.name || reqItem.orderItemId}" pois ele foi cancelado.`, 400);
        }

        const currentlyDelivered = deliveredQuantities.get(orderItem.id) || 0;
        const availableToDeliver = orderItem.quantity - currentlyDelivered;

        if (reqItem.quantity > availableToDeliver) {
          throw new AppError(`Quantidade solicitada para entrega (${reqItem.quantity}) excede a quantidade disponível (${availableToDeliver}) do item.`, 400);
        }

        // Marcar quantity atualizada no map para check global de status depois
        deliveredQuantities.set(orderItem.id, currentlyDelivered + reqItem.quantity);

        validItemsToDeliver.push({
          orderItemId: orderItem.id,
          quantity: reqItem.quantity
        });
      }

      if (validItemsToDeliver.length === 0) {
        throw new AppError('Nenhuma quantidade válida informada para entrega.', 400);
      }

      // 4. Criar a Entrega (Romaneio)
      const delivery = await tx.delivery.create({
        data: {
          organizationId,
          orderId,
          notes,
          status: DeliveryStatus.DELIVERED, // Começa como entregue / enviado
          items: {
            create: validItemsToDeliver.map(i => ({
              orderItemId: i.orderItemId,
              quantity: i.quantity
            }))
          }
        },
        include: { items: true }
      });

      // 5. Atualizar o Status dos OrderItems se entregues 100%
      for (const reqItem of validItemsToDeliver) {
        const orderItem = order.items.find((i: any) => i.id === reqItem.orderItemId);
        const totalNowDelivered = deliveredQuantities.get(orderItem.id) || 0;

        if (totalNowDelivered >= orderItem.quantity && orderItem.status !== OrderStatus.DELIVERED) {
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { status: OrderStatus.DELIVERED }
          });
        }
      }

      // 6. Atualizar o Status do Pedido Inteiro
      // Regra: Se todos os itens que NÃO estão CANCELADOS estiverem com quantidade entregue completa, o pedido está DELIVERED.
      let allDelivered = true;
      let hasAtLeastOneDelivered = false;

      for (const item of order.items) {
        if (item.status === OrderStatus.CANCELLED) continue;
        
        const totalItemDelivered = deliveredQuantities.get(item.id) || 0;
        if (totalItemDelivered < item.quantity) {
          allDelivered = false;
        } else {
          hasAtLeastOneDelivered = true;
        }
      }

      if (allDelivered && hasAtLeastOneDelivered && order.status !== OrderStatus.DELIVERED) {
        await tx.order.update({
          where: { id: order.id },
          data: { 
            status: OrderStatus.DELIVERED,
            deliveredAt: new Date()
          }
        });

        await tx.orderStatusHistory.create({
           data: {
              orderId,
              fromStatus: order.status,
              toStatus: OrderStatus.DELIVERED,
              userId,
              notes: `Entrega total do pedido (Romaneio automático).`
           }
        });
      }

      return { success: true, message: 'Romaneio de entrega gerado com sucesso.', data: delivery };
    });
  }
}

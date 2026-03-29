import { OrderStatus, TransactionType, ReceivableStatus, PayableStatus } from '@prisma/client';
import { AppError, NotFoundError } from '../../../../shared/infrastructure/errors/AppError';

export class CancelOrderItemsUseCase {
  constructor(private prisma: any) {}

  async execute(params: {
    orderId: string;
    itemIds: string[];
    organizationId: string;
    userId: string;
    reason?: string;
  }) {
    const { orderId, itemIds, organizationId, userId, reason } = params;

    if (!itemIds || itemIds.length === 0) {
      throw new AppError('Nenhum item selecionado para cancelamento.');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Buscar o Pedido e Itens
      const order = await tx.order.findUnique({
        where: { id: orderId, organizationId },
        include: {
          items: {
            include: { product: true }
          },
          accountsReceivable: true,
          transactions: {
            where: { status: { not: 'CANCELLED' } }
          }
        }
      });

      if (!order) {
        throw new NotFoundError('Pedido');
      }

      // Filtrar itens válidos para cancelamento
      const itemsToCancel = order.items.filter((item: any) => 
        itemIds.includes(item.id) && item.status !== OrderStatus.CANCELLED && item.status !== OrderStatus.DELIVERED
      );

      if (itemsToCancel.length === 0) {
        throw new AppError('Nenhum dos itens informados pode ser cancelado (já estão cancelados ou entregues).', 400);
      }

      // 2. Atualizar Status e Subtotal dos itens
      let totalCancelledAmount = 0;

      for (const item of itemsToCancel) {
        const itemAmount = Number(item.totalPrice);
        totalCancelledAmount += itemAmount;

        await tx.orderItem.update({
          where: { id: item.id },
          data: { 
            status: OrderStatus.CANCELLED, 
            notes: reason ? `Cancelado: ${reason}` : 'Cancelado' 
          }
        });
      }

      // 3. Recalcular Totais do Pedido
      const remainingItems = order.items.filter((item: any) => 
        !itemIds.includes(item.id) && item.status !== OrderStatus.CANCELLED
      );
      
      let newSubtotal = remainingItems.reduce((acc: number, item: any) => acc + Number(item.totalPrice), 0);
      let newTaxAmount = 0;
      let newDiscountBase = Number(order.discount);
      let newTotal = newSubtotal - newDiscountBase + newTaxAmount;

      if (newTotal < 0) {
        newDiscountBase = newSubtotal; 
        newTotal = 0;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          discount: newDiscountBase,
          total: newTotal
        }
      });

      // 4. Regras Financeiras
      const receivable = order.accountsReceivable[0];
      
      if (receivable && receivable.status === ReceivableStatus.PENDING) {
        // Reduz a Conta a Receber PENDENTE
        const newReceivableAmount = Number(receivable.amount) - totalCancelledAmount;
        
        if (newReceivableAmount < 0) {
           throw new AppError('O valor a cancelar excede o saldo pendente. Será necessário gerar estorno manual.', 400);
        }

        // Atualiza a AccountReceivable Master
        await tx.accountReceivable.update({
          where: { id: receivable.id },
          data: { amount: newReceivableAmount }
        });

        // Atualiza a Transação de DÉBITO associada
        const debitTransaction = order.transactions.find((t: any) => t.type === TransactionType.DEBIT && t.receivableId === receivable.id);
        if (debitTransaction) {
          await tx.transaction.update({
            where: { id: debitTransaction.id },
            data: { amount: Number(debitTransaction.amount) - totalCancelledAmount }
          });
          
          await tx.account.update({
            where: { id: debitTransaction.accountId },
            data: { balance: { decrement: totalCancelledAmount } }
          });
        }

        // Atualiza as Transações de INCOME rateadas
        const incomeTransactions = order.transactions.filter((t: any) => t.type === TransactionType.INCOME && t.receivableId === receivable.id);
        
        // Estratégia simples (gulosa): reduz os rateios de receita proporcionalmente ou o primeiro até zerar
        let amountLeftToReduce = totalCancelledAmount;

        for (const inc of incomeTransactions) {
          if (amountLeftToReduce <= 0) break;
          
          const currentIncAmount = Number(inc.amount);
          const deduct = Math.min(currentIncAmount, amountLeftToReduce);
          
          if (deduct > 0) {
            await tx.transaction.update({
               where: { id: inc.id },
               data: { amount: currentIncAmount - deduct }
            });
            
            await tx.account.update({
               where: { id: inc.accountId },
               data: { balance: { decrement: deduct } }
            });

            amountLeftToReduce -= deduct;
          }
        }
      } else if (receivable && receivable.status === ReceivableStatus.PAID) {
         // O cliente já pagou tudo, gerar uma Conta a Pagar de "Reembolso/Estorno"
         await tx.accountPayable.create({
            data: {
               organizationId,
               supplierId: order.customerId, // Vincula o cliente
               amount: totalCancelledAmount,
               dueDate: new Date(),
               status: PayableStatus.PENDING,
               notes: `Estorno de Cancelamento Parcial - Pedido ${order.orderNumber}`
            }
         });
         
         await tx.order.update({
            where: { id: order.id },
            data: { cancellationRefundAmount: totalCancelledAmount }
         });
      }

      // 5. Histórico do Pedido
      await tx.orderStatusHistory.create({
         data: {
            orderId,
            toStatus: order.status,
            userId,
            notes: `Cancelamento de ${itemsToCancel.length} item(ns). Motivo: ${reason || 'N/A'}`
         }
      });

      return { 
        success: true, 
        message: `${itemsToCancel.length} itens cancelados com sucesso.`, 
        totalCancelledAmount,
        newTotal
      };
    });
  }
}

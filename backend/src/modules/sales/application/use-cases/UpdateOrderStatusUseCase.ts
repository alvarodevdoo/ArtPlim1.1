import { Order } from '../../domain/entities/Order';
import { OrderStatus, OrderStatusEnum } from '../../domain/value-objects/OrderStatus';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { NotFoundError, ValidationError } from '../../../../shared/infrastructure/errors/AppError';
import { ProcessStatusService } from '../../../organization/services/ProcessStatusService';
import { ReceivableService } from '../../../finance/services/ReceivableService';
import { OrderStatus as OrderStatusPrisma } from '@prisma/client';

export class UpdateOrderStatusUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private prisma: any, // Injetar prisma para transações financeiras
    private processStatusService: ProcessStatusService
  ) { }

  async execute(id: string, status: string, details?: { userId?: string, reason?: string, paymentAction?: string, refundAmount?: number }): Promise<Order> {
    console.log(`[UpdateOrderStatus] Iniciando atualização do pedido ${id} para status ${status}`, { details });

    // Validar status
    const validStatuses = Object.values(OrderStatusEnum);
    if (!validStatuses.includes(status as OrderStatusEnum)) {
      throw new ValidationError('Status inválido');
    }

    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError('Pedido');
    }

    const newStatus = new OrderStatus(status as OrderStatusEnum);

    // Lógica para Status Customizado (UUID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(status);

    if (isUUID) {
      // É um Status Customizado
      const customStatus = await this.prisma.processStatus.findUnique({ where: { id: status } });
      if (!customStatus) {
        throw new ValidationError('Status customizado inválido');
      }

      // Atualizar ID do status customizado
      order.updateProcessStatusId(customStatus.id);

      // Mapear para o comportamento do sistema (Enum legado)
      // Se for CANCELLED no comportamento, executa lógica de cancelamento abaixo
      if (customStatus.mappedBehavior === OrderStatusEnum.CANCELLED) {
        // Deixa passar para o bloco de cancelamento
        status = OrderStatusEnum.CANCELLED;
      } else {
        // Atualiza o status legado para o comportamento mapeado
        order.changeStatus(new OrderStatus(customStatus.mappedBehavior as OrderStatusEnum));
      }
    } else {
      if (status === OrderStatusEnum.CANCELLED) {
        console.log(`[UpdateOrderStatus] Processando cancelamento do pedido ${id}`);
        order.cancel(details);

        // Lógica Financeira do Cancelamento
        if (details?.paymentAction && details?.paymentAction !== 'NONE' && details?.refundAmount && details.refundAmount > 0) {
          await this.processFinancialAction(order, details);
        }
      } else {
        // Se não for UUID e não for cancelado, atualiza status legado normalmente
        order.changeStatus(newStatus);
        
        // --- INÍCIO DA INTEGRAÇÃO FINANCEIRA ---
        if (status === OrderStatusEnum.APPROVED) {
          console.log(`[UpdateOrderStatus] Detectado status APPROVED. Iniciando apropriação financeira para o pedido ${id}`);
          await this.handleAppropriation(order, details);
        }
        // --- FIM DA INTEGRAÇÃO FINANCEIRA ---

        // Se estiver finalizando o pedido, atualizar campos do regime de competência
        if (newStatus.isFinished()) {
          console.log(`[UpdateOrderStatus] Pedido FINALIZADO. Atualizando accrualDate das transações para hoje.`);
          
          const now = new Date();
          
          // Atualizar accrualDate de todas as transações de receita (INCOME) deste pedido
          await this.prisma.transaction.updateMany({
            where: { 
              orderId: order.id, 
              type: 'INCOME' 
            },
            data: {
              accrualDate: now
            }
          });
          
          order.finishedAt = now;
        }
      }
    }

    const savedOrder = await this.orderRepository.save(order);
    console.log(`[UpdateOrderStatus] Pedido ${id} salvo com sucesso`);
    return savedOrder;
  }

  private async handleAppropriation(order: any, details: any) {
    try {
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId: order.organizationId }
      });

      if (!settings?.defaultReceivableCategoryId || !settings?.defaultRevenueCategoryId) {
        console.log('[UpdateOrderStatus] Apropriação ignorada: Categorias padrão não configuradas.');
        return;
      }

      // 1. Buscar o pedido completo com itens e produtos para obter as contas de receita
      // Usamos findUnique diretamente para garantir que temos os dados mais frescos e as relações
      const orderWithDetails = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!orderWithDetails) return;

      // 2. Buscar Conta de Receita Padrão (Fallback)
      let defaultRevenueAccount = await this.prisma.account.findFirst({
        where: { organizationId: order.organizationId, active: true, type: { notIn: ['RECEIVABLE', 'PAYABLE'] } }
      });
      
      // 3. Agrupar itens por Par (revenueAccountId + categoryId)
      const splitsMap = new Map<string, { amount: number, accountId: string, categoryId: string, description: string }>();

      for (const item of orderWithDetails.items) {
        // Resolve a conta: Produto -> Fallback Global
        const revenueAccountId = item.product?.revenueAccountId || defaultRevenueAccount?.id;
        
        // Resolve a categoria: Produto -> Fallback Global
        const categoryId = item.product?.categoryId || settings.defaultRevenueCategoryId;
        
        if (!revenueAccountId || !categoryId) {
          console.warn(`[UpdateOrderStatus] Falha ao resolver conta/categoria para o produto ${item.product?.name}`);
          continue;
        }

        const key = `${revenueAccountId}-${categoryId}`;
        const current = splitsMap.get(key) || { 
          amount: 0, 
          accountId: revenueAccountId, 
          categoryId: categoryId, 
          description: '' 
        };
        
        current.amount += Number(item.totalPrice);
        current.description = current.description 
          ? `${current.description}, ${item.product?.name || 'Item'}` 
          : `Rateio: ${item.product?.name || 'Item'}`;
        
        splitsMap.set(key, current);
      }

      // 4. Converter o mapa para o array de splits esperado pelo serviço
      const splits = Array.from(splitsMap.values()).map((data) => ({
        revenueAccountId: data.accountId,
        categoryId: data.categoryId,
        amount: Number(data.amount.toFixed(2)),
        description: data.description.substring(0, 255)
      }));

      // Ajuste fino para evitar erros de centavos (atribuir diferença ao primeiro split)
      const totalAmount = Number((order as any).total?.value || (order as any).total || 0);
      const sumSplits = splits.reduce((sum, s) => sum + s.amount, 0);
      const diff = totalAmount - sumSplits;
      if (Math.abs(diff) > 0 && splits.length > 0) {
        splits[0].amount = Number((splits[0].amount + diff).toFixed(2));
      }

      // 4. Buscar Conta de Recebíveis (Ativo)
      let receivableAccount = await this.prisma.account.findFirst({
        where: { organizationId: order.organizationId, type: 'RECEIVABLE', active: true }
      });

      if (!receivableAccount) {
        receivableAccount = await this.prisma.account.create({
          data: {
            organizationId: order.organizationId,
            name: 'Contas a Receber',
            type: 'RECEIVABLE',
            balance: 0,
            active: true
          }
        });
      }

      const receivableService = new ReceivableService(this.prisma);
      await receivableService.createReceivableFromOrder({
        organizationId: order.organizationId,
        customerId: order.customerId,
        orderId: order.id,
        amount: totalAmount,
        dueDate: (order as any).deliveryDate || new Date(),
        receivableAccountId: receivableAccount.id,
        splits,
        notes: `Apropriação automática - Pedido ${(order as any).orderNumber?.value || (order as any).orderNumber}`,
        userId: details?.userId || 'SYSTEM'
      });

      console.log(`[UpdateOrderStatus] Apropriação concluída para o pedido ${order.id}`);
    } catch (error) {
      console.error('[UpdateOrderStatus] Erro na apropriação financeira:', error);
    }
  }

  private async processFinancialAction(order: Order, details: any) {
    const refundAmount = Number(details.refundAmount);
    console.log(`[UpdateOrderStatus] Processando ação financeira: ${details.paymentAction}, Valor: ${refundAmount}`);

    if (details.paymentAction === 'REFUND') {
      // Criar transação de Despesa (Estorno)
      // Buscar a primeira conta ativa disponível
      const account = await this.prisma.account.findFirst({
        where: { organizationId: order.organizationId, active: true }
      });

      if (account) {
        await this.prisma.transaction.create({
          data: {
            organizationId: order.organizationId,
            accountId: account.id,
            type: 'EXPENSE',
            amount: refundAmount,
            description: `Estorno de Cancelamento - Pedido #${order.orderNumber.value}`,
            orderId: order.id,
            status: 'PAID',
            paidAt: new Date(),
            userId: details.userId,
            profileId: order.customerId
          }
        });

        // Atualizar saldo da conta
        await this.prisma.account.update({
          where: { id: account.id },
          data: { balance: { decrement: refundAmount } }
        });
        console.log(`[UpdateOrderStatus] Transação de reembolso criada na conta ${account.name}`);
      }
    } else if (details.paymentAction === 'CREDIT') {
      // Adicionar crédito ao saldo do Profile do cliente
      await this.prisma.profile.update({
        where: { id: order.customerId },
        data: { balance: { increment: refundAmount } }
      });
      console.log(`[UpdateOrderStatus] Crédito de ${refundAmount} adicionado ao saldo do cliente ${order.customerId}`);
    }
  }
}
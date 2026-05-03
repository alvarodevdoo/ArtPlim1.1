import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { OrderStatus } from '@prisma/client';
import { PricingEngine } from '../../shared/application/pricing/PricingEngine';
import { StatusEngine } from './domain/services/StatusEngine';
import { TransactionService } from '../finance/services/TransactionService';
import { PricingCompositionService } from '../catalog/services/PricingCompositionService';
import { IncompatibilityService } from '../catalog/services/IncompatibilityService';
import { ApproveOrderService } from './application/ApproveOrderService';
import { FinishOrderService } from './application/FinishOrderService';
import { ReopenOrderService } from './application/ReopenOrderService';
import { RegenerateProductionService } from './application/RegenerateProductionService';
import { OrderFinanceHelper } from '../../shared/utils/OrderFinanceHelper';
import { InventoryValuationService } from '../../shared/services/InventoryValuationService';
import { ReportWasteService } from './application/ReportWasteService';
import { ProfileBalanceService } from '../profiles/services/ProfileBalanceService';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  status: z.string().optional(),
  search: z.string().optional()
});

const statsQuerySchema = z.object({
  days: z.string().transform(val => parseInt(val) || 30).optional()
});

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    itemType: z.enum(['PRODUCT', 'SERVICE', 'PRINT_SHEET', 'PRINT_ROLL', 'LASER_CUT']).nullish(),
    width: z.number().min(0).nullish(),
    height: z.number().min(0).nullish(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
    costPrice: z.number().min(0).nullish(),
    calculatedPrice: z.number().min(0).nullish(),
    status: z.string().nullish(),
    processStatusId: z.string().nullish(),
    pricingRuleId: z.string().nullish(),
    attributes: z.record(z.any()).nullish()
  })),
  notes: z.string().nullish(),
  deliveryDate: z.string().nullish(),
  validUntil: z.string().nullish(),

  // Pagamentos
  payments: z.array(z.object({
    id: z.string().optional(),
    methodId: z.string().nullish(),
    methodName: z.string().nullish(),
    amount: z.number().positive(),
    fee: z.number().min(0),
    netAmount: z.number().positive(),
    installments: z.number().min(1).default(1),
    date: z.string(),
    justification: z.string().nullish()
  })).optional()
});

const updateOrderSchema = createOrderSchema.partial();

const simulateOrderSchema = z.object({
  productId: z.string().min(1),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  quantity: z.number().positive()
});



export async function salesRoutes(fastify: FastifyInstance) {
  
  // ========== PEDIDOS OTIMIZADOS ==========
  
  // Listar pedidos com QueryOptimizer
  fastify.get('/orders', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const queryOptimizer = new QueryOptimizer(prisma);
    
    const orders = await queryOptimizer.getOptimizedOrders(
      request.user!.organizationId,
      query.limit || 50,
      query.offset || 0,
      query.search,
      (query as any).status
    );
    
    return reply.send({
      success: true,
      data: orders
    });
  });

  // Estatísticas de pedidos otimizadas
  fastify.get('/orders/stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = statsQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (query.days || 30));

    // Buscar dados básicos dos pedidos
    const orders = await prisma.order.findMany({
      where: {
        organizationId: request.user!.organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true
      }
    });

    // Calcular estatísticas
    const total = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const avgOrderValue = total > 0 ? totalValue / total : 0;

    // Agrupar por status
    const byStatus = orders.reduce((acc, order) => {
      const status = order.status || 'UNKNOWN';
      if (!acc[status]) {
        acc[status] = { count: 0, value: 0 };
      }
      acc[status].count++;
      acc[status].value += Number(order.total || 0);
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    // Calcular valor pendente
    const pendingStatuses = ['APPROVED', 'IN_PRODUCTION'];
    const pendingValue = orders
      .filter(order => pendingStatuses.includes(order.status))
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overdueCount = orders.filter(order =>
      new Date(order.createdAt) < sevenDaysAgo &&
      !['DELIVERED', 'CANCELLED'].includes(order.status)
    ).length;

    const stats = {
      total,
      totalValue,
      byStatus,
      avgOrderValue,
      pendingValue,
      overdueCount
    };
    
    return reply.send({
      success: true,
      data: stats
    });
  });

  // ========== PEDIDOS CRUD ==========

  // Criar pedido
  fastify.post('/orders', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);

    // Validar se há produtos cadastrados
    const productCount = await prisma.product.count({
      where: { organizationId: request.user!.organizationId, active: true }
    });

    if (productCount === 0) {
      return reply.code(400).send({
        success: false,
        message: 'Não é possível criar pedidos sem produtos cadastrados.'
      });
    }

    // Validar produtos
    const productIds = body.items.map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: uniqueProductIds },
        organizationId: request.user!.organizationId,
        active: true
      }
    });

    if (existingProducts.length !== uniqueProductIds.length) {
       return reply.code(400).send({
         success: false,
         message: 'Um ou mais produtos não encontrados ou inativos.'
       });
    }

    // Validar cliente
    const customer = await prisma.profile.findFirst({
      where: {
        id: body.customerId,
        organizationId: request.user!.organizationId,
        isCustomer: true
      }
    });

    if (!customer) {
      return reply.code(400).send({
        success: false,
        message: 'Cliente não encontrado ou inválido.'
      });
    }

    // Gerar número
    const orderCount = await prisma.order.count({
      where: { organizationId: request.user!.organizationId }
    });
    const orderNumber = `PED-${String(orderCount + 1).padStart(4, '0')}`;

    const total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Busca a PRIMEIRA etapa do fluxo oficial da organização (Menor displayOrder)
    let defaultStatus = await prisma.processStatus.findFirst({
      where: { organizationId: request.user!.organizationId, mappedBehavior: 'DRAFT', active: true },
      orderBy: { displayOrder: 'asc' }
    });

    if (!defaultStatus) {
      defaultStatus = await prisma.processStatus.findFirst({
        where: { organizationId: request.user!.organizationId, active: true },
        orderBy: { displayOrder: 'asc' }
      });
    }

    const order = await (prisma as any).order.create({
      data: {
        organizationId: request.user!.organizationId,
        customerId: body.customerId,
        orderNumber,
        status: defaultStatus?.mappedBehavior || 'DRAFT',
        processStatusId: defaultStatus?.id,
        total,
        subtotal: total,
        notes: body.notes,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        items: {
          create: body.items.map(item => ({
            productId: item.productId,
            itemType: item.itemType || 'PRODUCT',
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            costPrice: item.costPrice || 0,
            calculatedPrice: item.calculatedPrice || item.unitPrice,
            status: (defaultStatus?.mappedBehavior as OrderStatus) || 'DRAFT',
            processStatusId: defaultStatus?.id || null,
            pricingRuleId: item.pricingRuleId || existingProducts.find(p => p.id === item.productId)?.pricingRuleId || null,
            attributes: item.attributes || {}
          }))
        },
        statusHistory: {
          create: {
            toStatus: defaultStatus?.mappedBehavior || 'DRAFT',
            toProcessStatusId: defaultStatus?.id,
            notes: `Pedido criado por ${(request.user as any)?.name || 'Usuário'}`,
            userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub
          }
        }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                fichasTecnicas: { include: { material: true } },
                components: { include: { material: true } },
                configurations: {
                  include: {
                    options: { include: { material: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Processar pagamentos
    if (body.payments && body.payments.length > 0) {
      let defaultAccount = await prisma.account.findFirst({
        where: { organizationId: request.user!.organizationId, active: true }
      });

      if (!defaultAccount) {
        defaultAccount = await prisma.account.create({
          data: {
            organizationId: request.user!.organizationId,
            name: 'Caixa Pv',
            type: 'CASH',
            balance: 0,
            active: true
          }
        });
      }

      const transactionService = new TransactionService(prisma);

      for (const p of body.payments) {
        // ── Pagamento via Saldo do Cliente ──
        if (p.methodId === 'BALANCE') {
          const balanceService = new ProfileBalanceService(prisma as any);
          await balanceService.useCredit({
            profileId: body.customerId,
            organizationId: request.user!.organizationId,
            amount: p.amount,
            description: `Pagamento via Saldo - Pedido ${orderNumber}`,
            orderId: order.id,
            userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub
          });
          continue;
        }

        // ── Pagamento normal via método financeiro ──
        const paymentMethod = await prisma.paymentMethod.findFirst({
          where: { id: p.methodId, organizationId: request.user!.organizationId }
        });
        const targetAccountId = paymentMethod?.accountId || defaultAccount.id;

        // Criar transação inicial pendente para passar pelas travas do serviço
        const tx = await transactionService.create({
          organizationId: request.user!.organizationId,
          accountId: targetAccountId,
          type: 'INCOME',
          amount: p.amount,
          description: `Pagamento Pedido ${orderNumber}`,
          orderId: order.id,
          userId: request.user!.userId,
          profileId: body.customerId
        });

        // Adicionar informações extras antes de aprovar
        await (prisma as any).transaction.update({
          where: { id: tx.id, organizationId: request.user!.organizationId },
          data: { paymentMethodId: p.methodId, paidAt: new Date(p.date) }
        });

        // Efetivar a transação, disparando o AccountService subjacente para somar no saldo
        await transactionService.markAsPaid(tx.id, request.user!.organizationId);
      }
    }

    return reply.code(201).send({
      success: true,
      data: order
    });
  });

  // Buscar pedido por ID
  fastify.get('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user!.organizationId },
      include: {
        customer: true,
        processStatus: true,
        items: {
          include: {
            product: {
              include: {
                fichasTecnicas: {
                  include: { material: true }
                },
                components: {
                  include: { material: true }
                },
                configurations: {
                  include: {
                    options: {
                      include: { material: true }
                    }
                  }
                }
              }
            }
          }
        },
        transactions: { include: { paymentMethod: true } }
      }
    });

    if (!order) {
      return reply.code(404).send({ success: false, message: 'Pedido não encontrado' });
    }

    return reply.send({ success: true, data: order });
  });

  // Buscar histórico de status do pedido
  fastify.get('/orders/:id/history', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);

    const history = await (prisma as any).orderStatusHistory.findMany({
      where: { orderId: id },
      include: {
        user: { select: { name: true } },
        toProcessStatus: true,
        fromProcessStatus: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: history });
  });

  // Simular preço
  fastify.post('/simulate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = simulateOrderSchema.parse(request.body);
    const pricingEngine = new PricingEngine();

    const result = await pricingEngine.execute({
      productId: body.productId,
      quantity: body.quantity,
      variables: {
        ...((request.body as any).variables || (request.body as any).attributes || {}),
        WIDTH: { value: body.width || 0, unit: 'mm' },
        HEIGHT: { value: body.height || 0, unit: 'mm' }
      },
      selectedOptionIds: (request.body as any).selectedOptionIds || [],
      organizationId: request.user!.organizationId
    });

    return reply.send({
      success: true,
      data: {
        ...result,
        productId: body.productId
      }
    });
  });

  // Atualizar pedido
  fastify.put('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateOrderSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);

    const existingOrder = await prisma.order.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });

    if (!existingOrder) {
      return reply.code(404).send({ success: false, message: 'Pedido não encontrado' });
    }

    if (existingOrder.status === 'DELIVERED') {
      return reply.code(400).send({ success: false, message: 'Pedidos entregues não podem ser editados' });
    }

    const updateData: any = {};
    if (body.customerId) updateData.customerId = body.customerId;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
    
    if (body.items) {
      const total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
      updateData.total = total;
      updateData.subtotal = total;

      // Deletar itens antigos antes de criar os novos (Estratégia de substituição total)
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      
      // Buscar regras originais dos produtos para fallback
      const productIds = body.items.map(item => item.productId);
      const uniqueIds = [...new Set(productIds)];
      const products = await prisma.product.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, pricingRuleId: true }
      });

      updateData.items = {
        create: body.items.map(item => ({
          productId: item.productId,
          itemType: (item as any).itemType || 'PRODUCT',
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          costPrice: item.costPrice || 0,
          calculatedPrice: item.calculatedPrice || item.unitPrice,
          status: (item.status as OrderStatus) || 'DRAFT',
          processStatusId: item.processStatusId || null,
          attributes: (item as any).attributes || {},
          pricingRuleId: (item as any).pricingRuleId || products.find(p => p.id === item.productId)?.pricingRuleId || null
        }))
      };
    }

    await prisma.order.update({
      where: { id },
      data: updateData
    });

    // Sincronizar status do pai após a recriação dos itens
    const statusEngine = new StatusEngine(prisma as any);
    await statusEngine.syncParentFromItems(id, (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub);

    // Processar NOVOS pagamentos
    if (body.payments && body.payments.length > 0) {
      // Filtrar apenas os pagamentos sem ID (novos)
      const novosPagamentos = body.payments.filter(p => !p.id);

      if (novosPagamentos.length > 0) {
        let defaultAccount = await prisma.account.findFirst({
          where: { organizationId: request.user!.organizationId, active: true }
        });

        if (!defaultAccount) {
          defaultAccount = await prisma.account.create({
            data: {
              organizationId: request.user!.organizationId,
              name: 'Caixa Pv',
              type: 'CASH',
              balance: 0,
              active: true
            }
          });
        }

        const transactionService = new TransactionService(prisma);

        for (const p of novosPagamentos) {
          // ── Pagamento via Saldo do Cliente ──
          if (p.methodId === 'BALANCE') {
            const balanceService = new ProfileBalanceService(prisma as any);
            await balanceService.useCredit({
              profileId: existingOrder.customerId,
              organizationId: request.user!.organizationId,
              amount: p.amount,
              description: `Pagamento via Saldo - Pedido ${existingOrder.orderNumber}`,
              orderId: existingOrder.id,
              userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub
            });
            continue;
          }

          // ── Pagamento normal via método financeiro ──
          const paymentMethod = await prisma.paymentMethod.findFirst({
            where: { id: p.methodId, organizationId: request.user!.organizationId }
          });
          const targetAccountId = paymentMethod?.accountId || defaultAccount.id;

          // Criar transação inicial pendente
          const tx = await transactionService.create({
            organizationId: request.user!.organizationId,
            accountId: targetAccountId,
            type: 'INCOME',
            amount: p.amount,
            description: `Pagamento Adicional Pedido ${existingOrder.orderNumber}`,
            orderId: existingOrder.id,
            userId: request.user!.userId,
            profileId: existingOrder.customerId
          });

          // Adicionar informações extras
          await (prisma as any).transaction.update({
            where: { id: tx.id, organizationId: request.user!.organizationId },
            data: { paymentMethodId: p.methodId, paidAt: new Date(p.date) }
          });

          // Efetivar a transação, disparando o AccountService subjacente para somar no saldo
          await transactionService.markAsPaid(tx.id, request.user!.organizationId);
        }
      }
    }

    // Buscar retorno final limpo e completo
    const finalResult = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        processStatus: true,
        items: { include: { product: true } },
        transactions: { include: { paymentMethod: true } }
      }
    });

    // Sincronizar Contas a Receber (Se houver título pendente)
    const updatedOrderForFinance = await prisma.order.findUnique({
      where: { id },
      include: { transactions: true }
    });

    if (updatedOrderForFinance) {
      const remainingBalance = OrderFinanceHelper.calculateRemainingBalance(updatedOrderForFinance);
      const pendingReceivable = await prisma.accountReceivable.findFirst({
        where: { orderId: id, status: 'PENDING', organizationId: request.user!.organizationId }
      });

      if (pendingReceivable) {
        await prisma.accountReceivable.update({
          where: { id: pendingReceivable.id },
          data: { 
            amount: remainingBalance,
            dueDate: updatedOrderForFinance.deliveryDate 
              ? new Date(updatedOrderForFinance.deliveryDate) 
              : pendingReceivable.dueDate,
            notes: (pendingReceivable.notes || '').includes('Valor ajustado na edição') 
              ? pendingReceivable.notes 
              : (pendingReceivable.notes || '') + ' | Valor ajustado na edição.'
          }
        });
      }
    }

    return reply.send({ success: true, data: finalResult });
  });

  // Atualizar status do pedido completo (Centralizado no Motor)
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, processStatusId, notes, reason, paymentAction, refundAmount } = request.body as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const statusEngine = new StatusEngine(prisma as any);
    const userId = (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub;
    const finalNotes = notes || reason || null;

    try {
      await statusEngine.updateOrderStatus({
        orderId: id,
        organizationId: request.user!.organizationId,
        newStatus: status,
        newProcessStatusId: processStatusId,
        userId,
        notes: finalNotes
      });

      if (finalNotes) {
        // Atualizar as notas legadas só para compatibilidade
        const existing = await (prisma as any).order.findUnique({ where: { id }, select: { notes: true } });
        const separator = existing?.notes ? '\n\n' : '';
        await prisma.order.update({
          where: { id },
          data: { notes: (existing?.notes || '') + separator + `[${new Date().toLocaleDateString('pt-BR')}] MOTIVO: ` + finalNotes }
        });
      }

      if (status === 'CANCELLED') {
        // Salvar os dados do cancelamento financeiro no pedido
        await prisma.order.update({
          where: { id },
          data: {
            cancellationPaymentAction: paymentAction || null,
            cancellationRefundAmount: refundAmount ? Number(refundAmount) : null
          }
        });

        // Lógica financeira de cancelamento
        if (paymentAction && paymentAction !== 'NONE' && refundAmount && Number(refundAmount) > 0) {
          const orderInfo = await prisma.order.findUnique({ where: { id }, select: { customerId: true, orderNumber: true } });
          if (orderInfo) {
            if (paymentAction === 'REFUND') {
              const account = await prisma.account.findFirst({
                where: { organizationId: request.user!.organizationId, active: true }
              });
              if (account) {
                await prisma.transaction.create({
                  data: {
                    organizationId: request.user!.organizationId,
                    accountId: account.id,
                    type: 'EXPENSE',
                    amount: Number(refundAmount),
                    description: `Estorno de Cancelamento - Pedido #${orderInfo.orderNumber}`,
                    orderId: id,
                    status: 'PAID',
                    paidAt: new Date(),
                    userId,
                    profileId: orderInfo.customerId
                  }
                });
                await prisma.account.update({
                  where: { id: account.id },
                  data: { balance: { decrement: Number(refundAmount) } }
                });
              }
            } else if (paymentAction === 'CREDIT') {
              const balanceService = new ProfileBalanceService(prisma as any);
              await balanceService.addCredit({
                profileId: orderInfo.customerId,
                organizationId: request.user!.organizationId,
                amount: Number(refundAmount),
                description: `Crédito por cancelamento do pedido #${orderInfo.orderNumber}`,
                orderId: id,
                userId
              });
            }
          }
        }
      }

      // Buscar pedido completo final para retorno
      const updatedResult = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          processStatus: true,
          items: {
            include: {
              product: {
                include: {
                  fichasTecnicas: { include: { material: true } },
                  components: { include: { material: true } },
                  configurations: {
                    include: {
                      options: { include: { material: true } }
                    }
                  }
                }
              }
            }
          },
          transactions: { include: { paymentMethod: true } }
        }
      });

      return reply.send({ success: true, data: updatedResult });
    } catch (error: any) {
      console.error('[SALES_STATUS_PATCH] Erro ao atualizar status:', error);
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  // Atualizar status de item específico (Usando StatusEngine)
  fastify.patch('/orders/items/:itemId/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const { status, notes } = request.body as { status: string, notes?: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const statusEngine = new StatusEngine(prisma as any);
    const userId = (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub;

    try {
      const updatedItem = await statusEngine.updateItemStatus({
        itemId,
        organizationId: request.user!.organizationId,
        newStatus: status,
        userId,
        notes: notes || 'Alteração manual no item.'
      }) as any;
      
      const orderId = updatedItem.orderId;
      
      // Buscar o pedido completo e atualizado para o frontend
      const fullUpdatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          processStatus: true,
          items: { include: { product: true } },
          transactions: { include: { paymentMethod: true } }
        }
      });

      return reply.send({ success: true, data: fullUpdatedOrder });
    } catch (error: any) {
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  // ========== MOTOR DE COMPOSIÇÃO ==========

  /**
   * POST /simulate-composition
   * Calcula o custo real de um produto com as opções selecionadas (sem efeito colateral).
   * Usado pelo frontend para exibir custo/lucro em tempo real durante a configuração.
   */
  fastify.post('/simulate-composition', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = z.object({
      productId: z.string().min(1),
      selectedOptionIds: z.array(z.string()).default([]),
      quantity: z.number().positive().default(1),
      width: z.number().optional(),
      height: z.number().optional()
    }).parse(request.body);

    const prisma = getTenantClient(request.user!.organizationId);
    const service = new PricingCompositionService(prisma);

    const result = await service.calculate({
      productId: body.productId,
      selectedOptionIds: body.selectedOptionIds,
      quantity: body.quantity,
      width: body.width,
      height: body.height,
      organizationId: request.user!.organizationId
    });

    return reply.send({ success: true, data: result });
  });

  /**
   * POST /orders/:id/approve
   */
  fastify.post('/orders/:id/confirm', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { processStatusId } = request.body as { processStatusId?: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ApproveOrderService(prisma);

    try {
      const result = await service.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        processStatusId
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[SALES_APPROVE] Erro ao aprovar pedido:', error);
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  /**
   * POST /orders/:id/finish
   * Finaliza o pedido, definindo finishedAt (gatilho DRE) e sincronizando o financeiro.
   */
  fastify.post('/orders/:id/finish', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { processStatusId } = request.body as { processStatusId?: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new FinishOrderService(prisma);

    try {
      const result = await service.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        processStatusId
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[SALES_FINISH] Erro ao finalizar pedido:', error);
      return reply.code(400).send({ success: false, message: error.message });
    }
  });



  /**
   * POST /orders/:id/reopen
   * Reverte o status do pedido para o imediatamente anterior (ex: FINISHED → APPROVED).
   * SEM impacto em estoque ou financeiro. Uso: correcão de clique acidental.
   */
  fastify.post('/orders/:id/reopen', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ReopenOrderService(prisma);

    try {
      const result = await service.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        reason
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[SALES_REOPEN] Erro ao reabrir pedido:', error);
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  /**
   * POST /orders/:id/regenerate
   * Regenera a producão de um pedido com defeito. Cancela OPs antigas, baixa estoque
   * novamente (custo de retrabalho) e volta o status para APPROVED.
   * O campo finishedAt e o financeiro são zerados pois a produção recomecu.
   */
  fastify.post('/orders/:id/regenerate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason: string; itemIds?: string[] };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new RegenerateProductionService(prisma);

    try {
      const result = await service.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        reason: body.reason,
        itemIds: body.itemIds
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[SALES_REGENERATE] Erro ao regenerar producão:', error);
      return reply.code(400).send({ success: false, message: error.message });
    }
  });


  /**
   * GET /orders/:id/incompatibilities
   * Retorna os IDs de opções incompatíveis com as opções já selecionadas.
   * Chamado em tempo real pelo frontend ao selecionar cada variação.
   */
  fastify.get('/orders/incompatibilities', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = z.object({
      selectedOptionIds: z.string().transform(v => v.split(',').filter(Boolean))
    }).parse(request.query);

    const prisma = getTenantClient(request.user!.organizationId);
    const service = new IncompatibilityService(prisma);

    const result = await service.getIncompatibleOptionIds(query.selectedOptionIds);
    return reply.send({ success: true, data: result });
  });

  /**
   * POST /orders/:id/items/:itemId/waste
   * Registra uma perda/retrabalho para um item de produção específico.
   * Cria registro analítico, consome estoque extra e aumenta o valor de `unitCostAtSale` da ordem.
   */
  const wasteBodySchema = z.object({
    materialId: z.string(),
    quantity: z.number().positive(),
    reason: z.string().min(3),
    unitCost: z.number().optional()
  });

  fastify.post('/orders/:id/items/:itemId/waste', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id: orderId, itemId } = request.params as { id: string, itemId: string };
    const body = wasteBodySchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    
    const valuationSvc = new InventoryValuationService(prisma as any);
    const service = new ReportWasteService(prisma as any, valuationSvc);

    try {
      const result = await service.execute({
        orderId,
        itemId,
        materialId: body.materialId,
        wasteQuantity: body.quantity,
        reason: body.reason,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        overrideUnitCost: body.unitCost
      });
      return reply.code(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  // ========== AUTORIZAÇÕES ==========

  const { AuthorizationService } = await import('./services/AuthorizationService');

  // Criar solicitação de autorização
  fastify.post('/authorizations/request', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = z.object({
      type: z.string(),
      data: z.any()
    }).parse(request.body);

    const service = new AuthorizationService();
    const result = await service.createRequest({
      organizationId: request.user!.organizationId,
      requesterId: request.user!.userId,
      type: body.type,
      data: body.data
    });

    return reply.code(201).send({ success: true, data: result });
  });

  // Listar solicitações pendentes (para supervisores)
  fastify.get('/authorizations/pending', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const service = new AuthorizationService();
    const result = await service.listPendingRequests(request.user!.organizationId);
    return reply.send({ success: true, data: result });
  });

  // Verificar status de uma solicitação
  fastify.get('/authorizations/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const service = new AuthorizationService();
    const result = await service.getRequestStatus(id);
    return reply.send({ success: true, data: result });
  });

  // Revisar solicitação (Aprovar/Rejeitar)
  fastify.post('/authorizations/:id/review', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, notes } = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      notes: z.string().optional()
    }).parse(request.body);

    const service = new AuthorizationService();
    const result = await service.reviewRequest(id, request.user!.userId, status, notes);
    return reply.send({ success: true, data: result });
  });
}
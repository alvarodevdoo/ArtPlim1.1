import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';
import { OrderStatus } from '@prisma/client';
import { PricingEngine } from '../../shared/application/pricing/PricingEngine';
import { StatusEngine } from './domain/services/StatusEngine';
import { TransactionService } from '../finance/services/TransactionService';

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
    methodId: z.string(),
    methodName: z.string(),
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
      query.search
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
        items: { include: { product: true } }
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
        // Obter método de pagamento para descobrir a conta destino
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
          orderId: order.id
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
        items: { include: { product: true } },
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
          // Obter método de pagamento para descobrir a conta destino
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
            orderId: existingOrder.id
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

    return reply.send({ success: true, data: finalResult });
  });

  // Atualizar status do pedido completo (Centralizado no Motor)
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, processStatusId, notes } = request.body as any;
    const prisma = getTenantClient(request.user!.organizationId);

    const statusEngine = new StatusEngine(prisma as any);
    await statusEngine.updateOrderStatus({
      orderId: id,
      organizationId: request.user!.organizationId,
      newStatus: status,
      newProcessStatusId: processStatusId,
      userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
      notes: notes || null
    });

    if (notes) {
      // Atualizar as notas legadas só para compatibilidade
      const existing = await (prisma as any).order.findUnique({ where: { id }, select: { notes: true } });
      const separator = existing?.notes ? '\n\n' : '';
      await prisma.order.update({
        where: { id },
        data: { notes: (existing?.notes || '') + separator + `[${new Date().toLocaleDateString('pt-BR')}] MOTIVO: ` + notes }
      });
    }

    // Buscar pedido completo final para retorno
    const updatedResult = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        processStatus: true,
        items: { include: { product: true } },
        transactions: { include: { paymentMethod: true } }
      }
    });

    return reply.send({ success: true, data: updatedResult });
  });

  // Atualizar status de item específico (Usando StatusEngine)
  fastify.patch('/orders/items/:itemId/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const { status } = request.body as { status: string };
    const prisma = getTenantClient(request.user!.organizationId);
    
    const statusEngine = new StatusEngine(prisma as any);
    try {
      const updatedItem = await statusEngine.updateItemStatus({
        itemId,
        organizationId: request.user!.organizationId,
        newStatus: status,
        userId: (request.user as any)?.id || (request.user as any)?.userId || (request.user as any)?.sub,
        notes: 'Alteração manual no item.'
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
}
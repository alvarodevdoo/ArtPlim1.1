import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { PricingEngine } from '../../shared/application/pricing/PricingEngine';

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
    itemType: z.enum(['PRODUCT', 'SERVICE', 'PRINT_SHEET', 'PRINT_ROLL', 'LASER_CUT']).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
    costPrice: z.number().min(0).optional(),
    calculatedPrice: z.number().min(0).optional()
  })),
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  validUntil: z.string().optional(),

  // Pagamentos
  payments: z.array(z.object({
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

/**
 * Calcula o status agregado de um pedido baseado no status de seus itens.
 */
function calculateAggregatedStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'DRAFT';

  const activeStatuses = statuses.filter(s => s !== 'CANCELLED');
  if (activeStatuses.length === 0) return 'CANCELLED';

  if (activeStatuses.some(s => s === 'DRAFT')) return 'DRAFT';

  const weights: Record<string, number> = {
    'DRAFT': 0,
    'APPROVED': 1,
    'IN_PRODUCTION': 2,
    'FINISHED': 3,
    'DELIVERED': 4
  };

  const minWeight = Math.min(...activeStatuses.map(s => weights[s] ?? 0));
  return Object.keys(weights).find(key => weights[key] === minWeight) || 'DRAFT';
}

/**
 * Sincroniza o status do pedido pai baseado nos itens.
 */
async function syncParentOrderStatus(orderId: string, prisma: any) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { status: true }
  });

  if (items.length === 0) return;

  const newStatus = calculateAggregatedStatus(items.map((i: any) => i.status));

  await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus }
  });
}

export async function salesRoutesOptimized(fastify: FastifyInstance) {
  
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

    const defaultStatus = await prisma.processStatus.findFirst({
      where: { organizationId: request.user!.organizationId, mappedBehavior: 'DRAFT' },
      orderBy: { displayOrder: 'asc' }
    });

    const order = await prisma.order.create({
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
            calculatedPrice: item.calculatedPrice || item.unitPrice
          }))
        }
      },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    // Processar pagamentos
    if (body.payments && body.payments.length > 0) {
      let account = await prisma.account.findFirst({
        where: { organizationId: request.user!.organizationId, active: true }
      });

      if (!account) {
        account = await prisma.account.create({
          data: {
            organizationId: request.user!.organizationId,
            name: 'Caixa Pv',
            type: 'CASH',
            balance: 0,
            active: true
          }
        });
      }

      for (const p of body.payments) {
        await prisma.transaction.create({
          data: {
            organizationId: request.user!.organizationId,
            accountId: account.id,
            type: 'INCOME',
            amount: p.amount,
            description: `Pagamento Pedido ${orderNumber}`,
            orderId: order.id,
            status: 'PAID',
            paidAt: new Date(p.date),
            paymentMethodId: p.methodId
          }
        });
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

  // Simular preço
  fastify.post('/simulate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = simulateOrderSchema.parse(request.body);
    const pricingEngine = new PricingEngine();

    const result = await pricingEngine.execute({
      productId: body.productId,
      width: body.width || 0,
      height: body.height || 0,
      quantity: body.quantity,
      variables: (request.body as any).variables || (request.body as any).attributes || {},
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

      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      updateData.items = {
        create: body.items.map(item => ({
          productId: item.productId,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          costPrice: item.costPrice || 0,
          calculatedPrice: item.calculatedPrice || item.unitPrice
        }))
      };
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: { include: { product: true } } }
    });

    return reply.send({ success: true, data: order });
  });

  // Atualizar status
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, processStatusId } = request.body as any;
    const prisma = getTenantClient(request.user!.organizationId);

    const existingOrder = await prisma.order.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });

    if (!existingOrder) {
      return reply.code(404).send({ success: false, message: 'Pedido não encontrado' });
    }

    const updateData: any = {};
    if (processStatusId) {
      const ps = await prisma.processStatus.findFirst({
        where: { id: processStatusId, organizationId: request.user!.organizationId }
      });
      if (ps) {
        updateData.processStatusId = processStatusId;
        updateData.status = ps.mappedBehavior;
      }
    } else if (status) {
      updateData.status = status;
      updateData.processStatusId = null;
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData
    });

    if (updateData.status) {
      await prisma.orderItem.updateMany({
        where: { orderId: id },
        data: { status: updateData.status }
      });
    }

    return reply.send({ success: true, data: order });
  });
}
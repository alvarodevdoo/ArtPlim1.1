import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';

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
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  quantity: z.number().positive()
});

/**
 * Calcula o status agregado de um pedido baseado no status de seus itens.
 * Regra: O status geral é o status do item "mais atrasado", ignorando cancelados.
 */
function calculateAggregatedStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'DRAFT';

  const activeStatuses = statuses.filter(s => s !== 'CANCELLED');
  if (activeStatuses.length === 0) return 'CANCELLED';

  // Se algum item ainda é rascunho, o pedido como um todo é um rascunho
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

export function createOptimizedSalesRoutes(prisma: PrismaClient) {
  const router = Router();

  // ========== PEDIDOS OTIMIZADOS ==========

  // Listar pedidos com QueryOptimizer
  router.get('/orders', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const queryOptimizer = new QueryOptimizer(prisma);

      const orders = await queryOptimizer.getOptimizedOrders(
        req.user.organizationId,
        query.limit || 50,
        query.offset || 0,
        query.search
      );

      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('Erro ao listar pedidos otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Estatísticas de pedidos otimizadas
  router.get('/orders/stats', async (req: any, res) => {
    try {
      const query = statsQuerySchema.parse(req.query);
      const queryOptimizer = new QueryOptimizer(prisma);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (query.days || 30));

      // Buscar dados básicos dos pedidos
      const orders = await prisma.order.findMany({
        where: {
          organizationId: req.user.organizationId,
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

      // Calcular valor pendente (pedidos em andamento)
      const pendingStatuses = ['APPROVED', 'IN_PRODUCTION'];
      const pendingValue = orders
        .filter(order => pendingStatuses.includes(order.status))
        .reduce((sum, order) => sum + Number(order.total || 0), 0);

      // Calcular pedidos em atraso (simplificado - pedidos criados há mais de 7 dias que não foram entregues)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const overdueCount = orders.filter(order =>
        new Date(order.createdAt) < sevenDaysAgo &&
        !['DELIVERED', 'CANCELLED'].includes(order.status)
      ).length;

      // Calcular crescimento mensal (simplificado - comparar com período anterior)
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - (query.days || 30));

      const previousOrders = await prisma.order.count({
        where: {
          organizationId: req.user.organizationId,
          createdAt: {
            gte: previousStartDate,
            lt: startDate
          }
        }
      });

      const monthlyGrowth = previousOrders > 0
        ? ((total - previousOrders) / previousOrders) * 100
        : 0;

      const stats = {
        total,
        totalValue,
        byStatus,
        avgOrderValue,
        monthlyGrowth,
        pendingValue,
        overdueCount
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erro ao obter estatísticas otimizadas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== PEDIDOS CRUD ==========

  // Criar pedido
  router.post('/orders', async (req: any, res) => {
    try {
      const body = createOrderSchema.parse(req.body);

      // Validar se há materiais cadastrados na organização (pré-requisito para produtos)
      // Removido conforme solicitação: não é obrigatório ter materiais para criar pedidos
      /*
      const materialCount = await prisma.material.count({
        where: {
          organizationId: req.user.organizationId,
          active: true
        }
      });

      if (materialCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível criar pedidos sem materiais cadastrados. Cadastre materiais primeiro.',
          code: 'NO_MATERIALS_AVAILABLE'
        });
      }
      */

      // Validar se há produtos cadastrados na organização
      const productCount = await prisma.product.count({
        where: {
          organizationId: req.user.organizationId,
          active: true
        }
      });

      if (productCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível criar pedidos sem produtos cadastrados. Cadastre produtos primeiro.',
          code: 'NO_PRODUCTS_AVAILABLE'
        });
      }

      // Validar se todos os produtos dos itens existem e estão ativos
      const productIds = body.items.map(item => item.productId);
      const uniqueProductIds = [...new Set(productIds)];

      const existingProducts = await prisma.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          organizationId: req.user.organizationId,
          active: true
        },
        select: { id: true, name: true }
      });

      if (existingProducts.length !== uniqueProductIds.length) {
        const missingIds = uniqueProductIds.filter(id =>
          !existingProducts.some(p => p.id === id)
        );

        // Tentar encontrar produtos inativos ou de outras organizações para dar feedback melhor
        const inactiveProducts = await prisma.product.findMany({
          where: {
            id: { in: missingIds },
            organizationId: req.user.organizationId,
            active: false
          },
          select: { id: true, name: true }
        });

        const otherOrgProducts = await prisma.product.findMany({
          where: {
            id: { in: missingIds },
            organizationId: { not: req.user.organizationId }
          },
          select: { id: true, name: true }
        });

        let errorMessage = 'Produtos não encontrados ou inativos: ';

        if (inactiveProducts.length > 0) {
          errorMessage += `Produtos inativos: ${inactiveProducts.map(p => p.name).join(', ')}. `;
        }

        if (otherOrgProducts.length > 0) {
          errorMessage += `Produtos de outra organização: ${otherOrgProducts.map(p => p.name).join(', ')}. `;
        }

        const trulyMissingIds = missingIds.filter(id =>
          !inactiveProducts.some(p => p.id === id) &&
          !otherOrgProducts.some(p => p.id === id)
        );

        if (trulyMissingIds.length > 0) {
          errorMessage += `IDs não encontrados: ${trulyMissingIds.join(', ')}.`;
        }

        return res.status(400).json({
          success: false,
          message: errorMessage,
          code: 'INVALID_PRODUCTS',
          details: {
            missing: missingIds,
            inactive: inactiveProducts.map(p => ({ id: p.id, name: p.name })),
            otherOrg: otherOrgProducts.map(p => ({ id: p.id, name: p.name }))
          }
        });
      }

      // Validar se o cliente existe e pertence à organização
      const customer = await prisma.profile.findFirst({
        where: {
          id: body.customerId,
          organizationId: req.user.organizationId,
          isCustomer: true
        }
      });

      if (!customer) {
        return res.status(400).json({
          success: false,
          message: 'Cliente não encontrado ou inválido.',
          code: 'INVALID_CUSTOMER'
        });
      }

      // Validar dados dos itens
      const invalidItems = body.items.filter(item => {
        return !item.productId ||
          !item.quantity || item.quantity <= 0 ||
          item.unitPrice === undefined || item.unitPrice < 0 ||
          item.totalPrice === undefined || item.totalPrice < 0;
      });

      if (invalidItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${invalidItems.length} item(ns) com dados inválidos. Verifique quantidade, preços unitários e totais.`,
          code: 'INVALID_ITEMS'
        });
      }

      // Calcular total do pedido
      const total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);

      // Gerar número do pedido
      const orderCount = await prisma.order.count({
        where: { organizationId: req.user.organizationId }
      });
      const orderNumber = `PED-${String(orderCount + 1).padStart(4, '0')}`;

      // Buscar o status de processo padrão (Aberto/DRAFT)
      const defaultProcessStatus = await prisma.processStatus.findFirst({
        where: { organizationId: req.user.organizationId, mappedBehavior: 'DRAFT' },
        orderBy: { displayOrder: 'asc' }
      });

      const order = await prisma.order.create({
        data: {
          organizationId: req.user.organizationId,
          customerId: body.customerId,
          orderNumber,
          status: defaultProcessStatus?.mappedBehavior || 'DRAFT',
          processStatusId: defaultProcessStatus?.id,
          total,
          subtotal: total, // Adicionando o campo subtotal obrigatório
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
              costPrice: item.costPrice || 0, // Adicionando costPrice obrigatório
              calculatedPrice: item.calculatedPrice || item.unitPrice // Adicionando calculatedPrice obrigatório
            }))
          }
        },
        include: {
          customer: true,
          processStatus: true,
          items: {
            include: {
              product: true
            }
          },
          transactions: true
        }
      });

      // 4. Processar pagamentos (se houver)
      if (body.payments && body.payments.length > 0) {
        // Garantir que existe uma conta para vincular as transações
        let account = await prisma.account.findFirst({
          where: {
            organizationId: req.user.organizationId,
            active: true
          }
        });

        if (!account) {
          // Criar conta padrão "Caixa Pv" se não existir
          account = await prisma.account.create({
            data: {
              organizationId: req.user.organizationId,
              name: 'Caixa Pv',
              type: 'CASH',
              balance: 0,
              active: true
            }
          });
        }

        const accountId = account.id;
        let totalPaid = 0;

        for (const p of body.payments) {
          totalPaid += p.amount;

          // Criar transação
          await prisma.transaction.create({
            data: {
              organizationId: req.user.organizationId,
              accountId,
              type: 'INCOME',
              amount: p.amount,
              description: `Pagamento Pedido ${orderNumber} - ${p.methodName}`,
              orderId: order.id,
              status: 'PAID',
              paidAt: new Date(p.date),
              paymentMethodId: p.methodId,
              auditNotes: p.justification || null
            }
          });
        }

        // 5. Verificar Saldo Excedente
        if (totalPaid > total) {
          const overpaidAmount = totalPaid - total;

          // Atualizar saldo do cliente
          await prisma.profile.update({
            where: { id: body.customerId },
            data: {
              balance: { increment: overpaidAmount }
            }
          });

          // Opcional: Criar log ou transação de crédito? 
          // Por enquanto, o incremento no balance é suficiente.
        }
      }

      // Re-fetch para incluir transações criadas
      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          processStatus: true,
          items: { include: { product: true } },
          transactions: { include: { paymentMethod: true } }
        }
      });

      res.status(201).json({
        success: true,
        data: finalOrder
      });
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);

      // Tratar erros específicos do Prisma
      if (error.code === 'P2003') {
        return res.status(400).json({
          success: false,
          message: 'Erro de integridade: produto ou cliente não encontrado. Verifique se todos os dados estão corretos.',
          code: 'FOREIGN_KEY_CONSTRAINT'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Buscar pedido por ID
  router.get('/orders/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        },
        include: {
          customer: true,
          processStatus: true,
          items: {
            include: {
              product: true
            }
          },
          transactions: {
            include: {
              paymentMethod: true
            }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar pedido
  router.put('/orders/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = updateOrderSchema.parse(req.body);

      // Verificar se o pedido existe e pertence à organização
      const existingOrder = await prisma.order.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado'
        });
      }

      // Verificar se o pedido pode ser editado (não pode estar entregue)
      if (existingOrder.status === 'DELIVERED') {
        return res.status(400).json({
          success: false,
          message: 'Pedidos entregues não podem ser editados'
        });
      }

      // Preparar dados para atualização
      const updateData: any = {};

      if (body.customerId) updateData.customerId = body.customerId;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
      if (body.validUntil) updateData.validUntil = new Date(body.validUntil);

      // Se há itens para atualizar, recalcular total
      if (body.items) {
        const total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
        updateData.total = total;
        updateData.subtotal = total; // Adicionando subtotal no update também

        // Deletar itens existentes e criar novos
        await prisma.orderItem.deleteMany({
          where: { orderId: id }
        });

        updateData.items = {
          create: body.items.map(item => ({
            productId: item.productId,
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            costPrice: item.costPrice || 0, // Adicionando costPrice obrigatório
            calculatedPrice: item.calculatedPrice || item.unitPrice // Adicionando calculatedPrice obrigatório
          }))
        };
      }

      const order = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          processStatus: true,
          items: {
            include: {
              product: true
            }
          },
          transactions: true
        }
      });

      // Atualizar pagamentos se fornecidos
      if (body.payments) {
        // Remover transações antigas deste pedido
        await prisma.transaction.deleteMany({
          where: { orderId: id }
        });

        // Garantir que existe uma conta para associar
        let account = await prisma.account.findFirst({
          where: {
            organizationId: req.user.organizationId,
            active: true
          }
        });

        // Se não existir conta, criar uma padrão "Caixa Pv"
        if (!account) {
          account = await prisma.account.create({
            data: {
              organizationId: req.user.organizationId,
              name: 'Caixa Pv',
              type: 'CASH',
              active: true
            }
          });
        }

        const accountId = account.id;
        let totalPaid = 0;

        for (const p of body.payments) {
          totalPaid += p.amount;

          await prisma.transaction.create({
            data: {
              organizationId: req.user.organizationId,
              accountId,
              type: 'INCOME',
              amount: p.amount,
              description: `Pagamento Pedido ${existingOrder.orderNumber} - ${p.methodName}`,
              orderId: id,
              status: 'PAID',
              paidAt: new Date(p.date),
              paymentMethodId: p.methodId,
              auditNotes: p.justification || null
            }
          });
        }

        // Atualização de crédito do cliente omitida por segurança nesta iteração rápida
      }

      // Re-fetch para garantir dados atualizados
      const finalOrder = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          processStatus: true,
          items: { include: { product: true } },
          transactions: { include: { paymentMethod: true } }
        }
      });

      res.json({
        success: true,
        data: finalOrder
      });
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar status do pedido
  router.patch('/orders/:id/status', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, processStatusId } = req.body;

      // Verificar se o pedido existe e pertence à organização
      const existingOrder = await prisma.order.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado'
        });
      }

      const updateData: any = {};

      if (processStatusId) {
        // Se forneceu ID do status personalizado, buscar para pegar o comportamento mapeado
        const processStatus = await prisma.processStatus.findFirst({
          where: { id: processStatusId, organizationId: req.user.organizationId }
        });

        if (!processStatus) {
          return res.status(400).json({
            success: false,
            message: 'Status personalizado não encontrado'
          });
        }

        updateData.processStatusId = processStatusId;
        updateData.status = processStatus.mappedBehavior;
      } else if (status) {
        // Fallback legado ou update direto de status base
        updateData.status = status;
        // Se mudou via status base, idealmente deveríamos limpar o custom status ou buscar um default
        // Por segurança, mantemos o processStatusId atual se for compatível, ou limpamos?
        // Vamos limpar para evitar inconsistências
        updateData.processStatusId = null;
      }

      const order = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // SINCRONIZAR ITENS: Se o status geral mudou, forçamos os itens a seguirem o mesmo status
      // Isso resolve o caso do usuário querer aprovar/finalizar tudo de uma vez.
      if (updateData.status) {
        await prisma.orderItem.updateMany({
          where: { orderId: id },
          data: { status: updateData.status }
        });
      }

      // Buscar o pedido atualizado com todos os relacionamentos para garantir que o frontend receba os itens sincronizados
      const fullOrder = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          processStatus: true,
          items: {
            orderBy: { id: 'asc' }, // Maintain insertion order
            include: {
              product: true,
              processStatus: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: fullOrder
      });
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar status de um ITEM do pedido (Workflow granular)
  router.patch('/orders/items/:id/status', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validar status
      if (!['DRAFT', 'APPROVED', 'IN_PRODUCTION', 'FINISHED', 'DELIVERED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido' });
      }

      // Verificar se o item pertence à organização do usuário
      const item = await prisma.orderItem.findFirst({
        where: {
          id,
          order: { organizationId: req.user.organizationId }
        }
      });

      if (!item) {
        return res.status(404).json({ success: false, message: 'Item não encontrado' });
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id },
        data: { status },
        include: {
          product: { select: { name: true } },
          processStatus: true
        }
      });

      // SINCRONIZAR PAI: Recalcular status do pedido pai baseado na mudança do item
      await syncParentOrderStatus(item.orderId, prisma);

      // Buscar o pedido completo atualizado para retornar ao frontend
      const fullOrder = await prisma.order.findUnique({
        where: { id: item.orderId },
        include: {
          customer: true,
          processStatus: true,
          items: {
            include: {
              product: true,
              processStatus: true
            }
          }
        }
      });

      res.json({ success: true, data: fullOrder });
    } catch (error) {
      console.error('Erro ao atualizar status do item:', error);
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });

  // Simular preço do pedido
  router.post('/simulate', async (req: any, res) => {
    try {
      const body = simulateOrderSchema.parse(req.body);

      // Buscar produto
      const product = await prisma.product.findFirst({
        where: {
          id: body.productId,
          organizationId: req.user.organizationId
        },
        include: {
          components: {
            include: {
              material: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Calcular preço baseado no modo de precificação
      let unitPrice = 0;
      let totalPrice = 0;

      if ((product.pricingMode as string) === 'UNIT') {
        unitPrice = Number(product.salePrice || 0);
        totalPrice = unitPrice * body.quantity;
      } else if ((product.pricingMode as string) === 'SIMPLE_AREA' && body.width && body.height) {
        const area = (body.width * body.height) / 1000000; // converter para m²
        unitPrice = Number(product.salePrice || 0) * area;
        totalPrice = unitPrice * body.quantity;
      } else {
        // Para COMPLEX_AREA, usar cálculo simplificado por enquanto
        const area = body.width && body.height ? (body.width * body.height) / 1000000 : 1;
        unitPrice = Number(product.salePrice || 0) * area;
        totalPrice = unitPrice * body.quantity;
      }

      res.json({
        success: true,
        data: {
          productId: body.productId,
          productName: product.name,
          pricingMode: product.pricingMode,
          unitPrice,
          totalPrice,
          quantity: body.quantity,
          width: body.width,
          height: body.height
        }
      });
    } catch (error) {
      console.error('Erro ao simular preço:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}
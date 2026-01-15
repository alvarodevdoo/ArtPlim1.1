import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  status: z.string().optional()
});

const statsQuerySchema = z.object({
  days: z.string().transform(val => parseInt(val) || 30).optional()
});

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
    costPrice: z.number().positive().optional(), // Opcional no frontend, será 0 por padrão
    calculatedPrice: z.number().positive().optional() // Opcional no frontend, será unitPrice por padrão
  })),
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  validUntil: z.string().optional()
});

const updateOrderSchema = createOrderSchema.partial();

const simulateOrderSchema = z.object({
  productId: z.string().min(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  quantity: z.number().positive()
});

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
        query.offset || 0
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
      const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const avgOrderValue = total > 0 ? totalValue / total : 0;

      // Agrupar por status
      const byStatus = orders.reduce((acc, order) => {
        const status = order.status || 'UNKNOWN';
        if (!acc[status]) {
          acc[status] = { count: 0, value: 0 };
        }
        acc[status].count++;
        acc[status].value += order.total || 0;
        return acc;
      }, {} as Record<string, { count: number; value: number }>);

      // Calcular valor pendente (pedidos em andamento)
      const pendingStatuses = ['APPROVED', 'IN_PRODUCTION'];
      const pendingValue = orders
        .filter(order => pendingStatuses.includes(order.status))
        .reduce((sum, order) => sum + (order.total || 0), 0);

      // Calcular pedidos em atraso (simplificado - pedidos criados há mais de 7 dias que não foram entregues)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const overdueCount = orders.filter(order =>
        order.createdAt < sevenDaysAgo &&
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
          !item.unitPrice || item.unitPrice <= 0 ||
          !item.totalPrice || item.totalPrice <= 0;
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

      const order = await prisma.order.create({
        data: {
          organizationId: req.user.organizationId,
          customerId: body.customerId,
          orderNumber,
          status: 'DRAFT',
          total,
          subtotal: total, // Adicionando o campo subtotal obrigatório
          notes: body.notes,
          deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
          items: {
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
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error) {
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
          items: {
            include: {
              product: true
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
          items: {
            include: {
              product: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: order
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
      const { status } = req.body;

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

      const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
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

      if (product.pricingMode === 'UNIT') {
        unitPrice = product.salePrice || 0;
        totalPrice = unitPrice * body.quantity;
      } else if (product.pricingMode === 'SIMPLE_AREA' && body.width && body.height) {
        const area = (body.width * body.height) / 1000000; // converter para m²
        unitPrice = (product.salePrice || 0) * area;
        totalPrice = unitPrice * body.quantity;
      } else {
        // Para COMPLEX_AREA, usar cálculo simplificado por enquanto
        const area = body.width && body.height ? (body.width * body.height) / 1000000 : 1;
        unitPrice = (product.salePrice || 0) * area;
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
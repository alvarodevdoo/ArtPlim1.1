import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase';
import { UpdateOrderUseCase } from '../../application/use-cases/UpdateOrderUseCase';
import { GetOrderUseCase } from '../../application/use-cases/GetOrderUseCase';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase';
import { GetOrderStatsUseCase } from '../../application/use-cases/GetOrderStatsUseCase';
import { CancelOrderItemsUseCase } from '../../application/use-cases/CancelOrderItemsUseCase';
import { CreateDeliveryUseCase } from '../../application/use-cases/CreateDeliveryUseCase';
import { CreateOrderDTO } from '../../application/dto/CreateOrderDTO';
import { OrderPaymentProcessor } from '../../application/services/OrderPaymentProcessor';
import { getTenantClient } from '../../../../shared/infrastructure/database/tenant';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

// Serviços de Transição
import { ApproveOrderService } from '../../application/ApproveOrderService';
import { FinishOrderService } from '../../application/FinishOrderService';
import { ReopenOrderService } from '../../application/ReopenOrderService';
import { RegenerateProductionService } from '../../application/RegenerateProductionService';
import { ReportWasteService } from '../../application/ReportWasteService';
import { PricingCompositionService } from '../../../catalog/services/PricingCompositionService';
import { IncompatibilityService } from '../../../catalog/services/IncompatibilityService';

export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private updateOrderUseCase: UpdateOrderUseCase,
    private getOrderUseCase: GetOrderUseCase,
    private listOrdersUseCase: ListOrdersUseCase,
    private updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private getOrderStatsUseCase: GetOrderStatsUseCase,
    private cancelOrderItemsUseCase: CancelOrderItemsUseCase,
    private createDeliveryUseCase: CreateDeliveryUseCase,
    private approveOrderService: ApproveOrderService,
    private finishOrderService: FinishOrderService,
    private reopenOrderService: ReopenOrderService,
    private regenerateProductionService: RegenerateProductionService,
    private reportWasteService: ReportWasteService,
    private pricingCompositionService: PricingCompositionService,
    private incompatibilityService: IncompatibilityService,
    private websocketServer?: any
  ) { }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateOrderDTO;
      const userId = (request as any).user?.userId || 'system';
      const order = await this.createOrderUseCase.execute(data, userId);

      // Processar pagamentos
      if (data.payments && data.payments.length > 0) {
        const prisma = getTenantClient(request.user!.organizationId);
        const paymentProcessor = new OrderPaymentProcessor(prisma);
        await paymentProcessor.process(order.id, data.payments, (request as any).user);
      }

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-created', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: (order as any).customer?.name
        });
      }

      return reply.status(201).send({
        success: true,
        data: order.toJSON()
      });
    } catch (error: any) {
      throw error;
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as CreateOrderDTO;
      const userId = (request as any).user?.userId || 'system';
      const result = await this.updateOrderUseCase.execute(id, data, userId);

      // Processar pagamentos
      if (data.payments) {
        const prisma = getTenantClient(request.user!.organizationId);
        const paymentProcessor = new OrderPaymentProcessor(prisma);
        await paymentProcessor.process(id, data.payments, (request as any).user);
      }

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          orderNumber: result.order.orderNumber
        });
      }

      return reply.send({
        success: true,
        data: result.order.toJSON(),
        hasPendingChanges: result.hasPendingChanges,
        pendingChangeId: result.pendingChangeId
      });
    } catch (error: any) {
      throw error;
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const order = await this.getOrderUseCase.execute(id);

      const orderData = order.toJSON();

      // Buscar dados do customer e produtos com o Prisma do Tenant
      const prisma = getTenantClient(request.user!.organizationId);
      const customer = await this.getCustomerData(prisma, order.customerId);

      // Buscar dados dos produtos para cada item
      const itemsWithProduct = await Promise.all(
        orderData.items.map(async (item: any) => {
          const product = await this.getProductData(prisma, item.productId, item.pricingRuleId);
          return {
            ...item,
            product: product || {
              id: item.productId,
              name: 'Produto não encontrado',
              description: null
            }
          };
        })
      );

      return reply.send({
        success: true,
        data: {
          ...orderData,
          customer: customer || {
            id: order.customerId,
            name: 'Cliente não encontrado',
            email: null,
            phone: null,
            address: null,
            city: null,
            state: null,
            zipCode: null
          },
          items: itemsWithProduct
        }
      });
    } catch (error: any) {
      throw error;
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;

      const filters = {
        organizationId: request.user?.organizationId,
        status: query.status,
        search: query.search,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        customer: query.customer
      };

      const orders = await this.listOrdersUseCase.execute(filters);

      // Para cada      // Buscar detalhes adicionais para cada pedido
      const prisma = getTenantClient(request.user!.organizationId);
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const orderData = order.toJSON();
          const customer = await this.getCustomerData(prisma, order.customerId);

          const itemsWithProduct = await Promise.all(
            orderData.items.map(async (item: any) => {
              const product = await this.getProductData(prisma, item.productId, item.pricingRuleId);
              return {
                ...item,
                product: product || {
                  id: item.productId,
                  name: 'Produto não encontrado',
                  pricingMode: 'SIMPLE_UNIT'
                }
              };
            })
          );

          return {
            ...orderData,
            customer: customer || {
              id: order.customerId,
              name: 'Cliente não encontrado',
              email: null,
              phone: null
            },
            items: itemsWithProduct
          };
        })
      );

      return reply.send({
        success: true,
        data: ordersWithDetails
      });
    } catch (error: any) {
      console.error('[OrderController] Erro na listagem de pedidos:', error);
      return reply.status(500).send({
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
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
    } catch (error: any) {
      throw error;
    }
  }

  async simulateComposition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = z.object({
        productId: z.string().min(1),
        selectedOptionIds: z.array(z.string()).default([]),
        quantity: z.number().positive().default(1),
        width: z.number().optional(),
        height: z.number().optional()
      }).parse(request.body);

      const result = await this.pricingCompositionService.calculate({
        productId: body.productId,
        selectedOptionIds: body.selectedOptionIds,
        quantity: body.quantity,
        width: body.width,
        height: body.height,
        organizationId: request.user!.organizationId
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async confirm(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { processStatusId } = request.body as { processStatusId?: string };
      
      const result = await this.approveOrderService.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.userId,
        processStatusId
      });

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          orderNumber: (result as any).order?.orderNumber || (result as any).orderNumber,
          status: 'APPROVED'
        });
      }

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async finish(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { processStatusId } = request.body as { processStatusId?: string };
      
      const result = await this.finishOrderService.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.userId,
        processStatusId
      });

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          orderNumber: (result as any).order?.orderNumber || (result as any).orderNumber,
          status: 'FINISHED'
        });
      }

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async reopen(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      
      const result = await this.reopenOrderService.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.userId,
        reason
      });

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          status: 'REOPENED'
        });
      }

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async regenerate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { reason: string; itemIds?: string[] };
      
      const result = await this.regenerateProductionService.execute({
        orderId: id,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.userId,
        reason: body.reason,
        itemIds: body.itemIds
      });

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          status: 'REGENERATED'
        });
      }

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async getIncompatibilities(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = z.object({
        selectedOptionIds: z.string().transform(v => v.split(',').filter(Boolean))
      }).parse(request.query);

      const result = await this.incompatibilityService.getIncompatibleOptionIds(query.selectedOptionIds);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  async reportWaste(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: orderId, itemId } = request.params as { id: string, itemId: string };
      const body = z.object({
        materialId: z.string(),
        quantity: z.number().positive(),
        reason: z.string().min(3),
        unitCost: z.number().optional()
      }).parse(request.body);
      
      const result = await this.reportWasteService.execute({
        orderId,
        itemId,
        materialId: body.materialId,
        wasteQuantity: body.quantity,
        reason: body.reason,
        organizationId: request.user!.organizationId,
        userId: (request.user as any)?.userId,
        overrideUnitCost: body.unitCost
      });
      return reply.code(201).send({ success: true, data: result });
    } catch (error: any) {
      throw error;
    }
  }

  private async getCustomerData(prisma: PrismaClient, customerId: string) {
    try {
      return await (prisma as any).profile.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      });
    } catch (error) {
      return null;
    }
  }

  private async getProductData(prisma: PrismaClient, productId: string, fixedRuleId?: string) {
    try {
      const product = await (prisma as any).product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          description: true,
          pricingMode: true,
          salePrice: true,
          pricingRuleId: true,
          isCommissionable: true,
          specificCommissionRate: true,
          maxDiscountThreshold: true,
          fichasTecnicas: {
            select: {
              id: true,
              insumoId: true,
              quantidade: true,
              material: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  averageCost: true,
                  costPerUnit: true
                }
              }
            }
          },
          components: {
            select: {
              id: true,
              materialId: true,
              material: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  averageCost: true,
                  costPerUnit: true
                }
              }
            }
          },
          configurations: {
            select: {
              id: true,
              name: true,
              options: {
                select: {
                  id: true,
                  label: true,
                  materialId: true,
                  material: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                      averageCost: true,
                      costPerUnit: true
                    }
                  }
                }
              }
            }
          },
          pricingRule: {
            select: {
              id: true,
              name: true,
              formula: true,
              config: true
            }
          }
        }
      });

      // Se houver uma regra fixa (versão histórica), buscamos e substituímos a regra atual
      const ruleToUse = fixedRuleId || product?.pricingRuleId;

      if (ruleToUse && product) {
        const Rule = await (prisma as any).pricingRule.findUnique({
          where: { id: ruleToUse },
          select: {
            id: true,
            name: true,
            formula: true,
            config: true
          }
        });

        if (Rule) {
          product.pricingRule = Rule;
        }
      }

      return {
        ...product,
        _debug: "V6"
      };
    } catch (error) {
      console.error('Erro ao buscar dados do produto:', error);
      return null;
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { status, processStatusId, reason, paymentAction, refundAmount } = request.body as {
        status?: string;
        processStatusId?: string;
        reason?: string;
        paymentAction?: string;
        refundAmount?: number;
      };

      const userId = (request as any).user?.userId;

      // O UseCase aceita tanto o Enum de status quanto o UUID do processStatusId
      const targetStatus = processStatusId || status;

      if (!targetStatus) {
        return reply.status(400).send({ success: false, message: 'Status ou processStatusId é obrigatório' });
      }

      const order = await this.updateOrderStatusUseCase.execute(id, targetStatus, {
        userId,
        reason,
        paymentAction,
        refundAmount
      });

      // Notificar via WebSocket
      if (this.websocketServer) {
        this.websocketServer.notifyOrganization(request.user!.organizationId, 'order-updated', {
          orderId: id,
          orderNumber: (order as any).orderNumber,
          status: targetStatus
        });
      }

      return reply.send({
        success: true,
        data: order.toJSON()
      });
    } catch (error: any) {
      throw error;
    }
  }

  async cancelItems(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { itemIds, reason } = request.body as { itemIds: string[]; reason?: string };
      const userId = (request as any).user?.userId || 'system';
      const organizationId = request.user?.organizationId;

      if (!organizationId) {
        return reply.status(401).send({ success: false, message: 'Organization required' });
      }

      const result = await this.cancelOrderItemsUseCase.execute({
        orderId: id,
        itemIds,
        organizationId,
        userId,
        reason
      });

      return reply.send(result);
    } catch (error: any) {
      throw error;
    }
  }

  async createDelivery(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { items, notes } = request.body as { items: { orderItemId: string, quantity: number }[]; notes?: string };
      const userId = (request as any).user?.userId || 'system';
      const organizationId = request.user?.organizationId;

      if (!organizationId) {
        return reply.status(401).send({ success: false, message: 'Organization required' });
      }

      const result = await this.createDeliveryUseCase.execute({
        orderId: id,
        items,
        organizationId,
        userId,
        notes
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      throw error;
    }
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user?.organizationId;

      if (!organizationId) {
        return reply.status(401).send({
          success: false,
          error: {
            message: 'Organization ID not found',
            statusCode: 401
          }
        });
      }

      const stats = await this.getOrderStatsUseCase.execute(organizationId);

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error: any) {
      throw error;
    }
  }

  async simulate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId, quantity, variables, selectedOptionIds: bodySelectedOptionIds } = request.body as any;
      const organizationId = request.user?.organizationId;

      if (!organizationId) {
        return reply.status(401).send({
          success: false,
          error: { message: 'Organization required', statusCode: 401 }
        });
      }

      const pricingEngine = new (require('../../../../shared/application/pricing/PricingEngine').PricingEngine)();
      
      const result = await pricingEngine.execute({
        productId,
        quantity,
        variables: variables || {},
        selectedOptionIds: bodySelectedOptionIds || [],
        organizationId
      });

      return reply.send({
        success: true,
        data: {
          unitPrice: result.unitPrice,
          totalPrice: result.totalPrice,
          costPrice: result.costPrice,
          details: result.details,
          insumos: result.insumos
        }
      });
    } catch (error: any) {
      throw error;
    }
  }
}
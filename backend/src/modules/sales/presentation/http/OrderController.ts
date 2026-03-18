import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase';
import { UpdateOrderUseCase } from '../../application/use-cases/UpdateOrderUseCase';
import { GetOrderUseCase } from '../../application/use-cases/GetOrderUseCase';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase';
import { GetOrderStatsUseCase } from '../../application/use-cases/GetOrderStatsUseCase';
import { CreateOrderDTO } from '../../application/dto/CreateOrderDTO';

export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private updateOrderUseCase: UpdateOrderUseCase,
    private getOrderUseCase: GetOrderUseCase,
    private listOrdersUseCase: ListOrdersUseCase,
    private updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private getOrderStatsUseCase: GetOrderStatsUseCase
  ) { }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateOrderDTO;
      const order = await this.createOrderUseCase.execute(data);

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
      const userId = (request as any).user?.id || 'system';
      const result = await this.updateOrderUseCase.execute(id, data, userId);

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

      // Buscar dados do customer
      const customer = await this.getCustomerData(order.customerId);

      // Buscar dados dos produtos para cada item
      const itemsWithProduct = await Promise.all(
        orderData.items.map(async (item: any) => {
          const product = await this.getProductData(item.productId);
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

      // Para cada pedido, buscar dados do customer e produtos
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const orderData = order.toJSON();

          // Buscar dados do customer
          const customer = await this.getCustomerData(order.customerId);

          // Buscar dados dos produtos para cada item
          const itemsWithProduct = await Promise.all(
            orderData.items.map(async (item: any) => {
              const product = await this.getProductData(item.productId);
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
      throw error;
    }
  }

  private async getCustomerData(customerId: string) {
    // TODO: Substituir por injeção de dependência do CustomerService
    const { prisma } = require('../../../../shared/infrastructure/database/prisma');

    try {
      return await prisma.profile.findUnique({
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

  private async getProductData(productId: string) {
    // TODO: Substituir por injeção de dependência do ProductService
    const { prisma } = require('../../../../shared/infrastructure/database/prisma');

    try {
      return await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          description: true,
          pricingMode: true,
          salePrice: true
        }
      });
    } catch (error) {
      return null;
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { status, reason, paymentAction, refundAmount } = request.body as {
        status: string;
        reason?: string;
        paymentAction?: string;
        refundAmount?: number;
      };

      const userId = (request as any).user?.id;

      const order = await this.updateOrderStatusUseCase.execute(id, status, {
        userId,
        reason,
        paymentAction,
        refundAmount
      });

      return reply.send({
        success: true,
        data: order.toJSON()
      });
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
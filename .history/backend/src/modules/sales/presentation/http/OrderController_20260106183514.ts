import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase';
import { GetOrderUseCase } from '../../application/use-cases/GetOrderUseCase';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase';
import { GetOrderStatsUseCase } from '../../application/use-cases/GetOrderStatsUseCase';
import { CreateOrderDTO } from '../../application/dto/CreateOrderDTO';

export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private getOrderUseCase: GetOrderUseCase,
    private listOrdersUseCase: ListOrdersUseCase,
    private updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private getOrderStatsUseCase: GetOrderStatsUseCase
  ) {}

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

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const order = await this.getOrderUseCase.execute(id);
      
      const orderData = order.toJSON();
      
      // Buscar dados do customer
      const customer = await this.getCustomerData(order.customerId);
      
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
          }
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
      
      // Para cada pedido, buscar dados do customer
      const ordersWithCustomer = await Promise.all(
        orders.map(async (order) => {
          const orderData = order.toJSON();
          
          // Buscar dados do customer usando o serviço temporário
          // TODO: Mover para um serviço dedicado quando o módulo de identity for criado
          const customer = await this.getCustomerData(order.customerId);
          
          return {
            ...orderData,
            customer: customer || { 
              id: order.customerId, 
              name: 'Cliente não encontrado',
              email: null,
              phone: null 
            }
          };
        })
      );
      
      return reply.send({
        success: true,
        data: ordersWithCustomer
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

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };
      
      const order = await this.updateOrderStatusUseCase.execute(id, status);
      
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
}
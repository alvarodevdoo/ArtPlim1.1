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
      
      return reply.send({
        success: true,
        data: order.toJSON()
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
      
      return reply.send({
        success: true,
        data: orders.map(order => order.toJSON())
      });
    } catch (error: any) {
      throw error;
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
}
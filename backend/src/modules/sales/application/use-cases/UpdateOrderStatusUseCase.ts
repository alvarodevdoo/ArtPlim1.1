import { Order } from '../../domain/entities/Order';
import { OrderStatus, OrderStatusEnum } from '../../domain/value-objects/OrderStatus';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { NotFoundError, ValidationError } from '../../../../shared/infrastructure/errors/AppError';

export class UpdateOrderStatusUseCase {
  constructor(private orderRepository: OrderRepository) {}

  async execute(id: string, status: string): Promise<Order> {
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
    order.changeStatus(newStatus);

    return await this.orderRepository.save(order);
  }
}
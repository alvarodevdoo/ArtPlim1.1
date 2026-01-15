import { Order } from '../../domain/entities/Order';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { NotFoundError } from '../../../../shared/infrastructure/errors/AppError';

export class GetOrderUseCase {
  constructor(private orderRepository: OrderRepository) {}

  async execute(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    
    if (!order) {
      throw new NotFoundError('Pedido');
    }

    return order;
  }
}
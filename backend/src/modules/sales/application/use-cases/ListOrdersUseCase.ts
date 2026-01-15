import { Order } from '../../domain/entities/Order';
import { OrderRepository, OrderFilters } from '../../domain/repositories/OrderRepository';

export class ListOrdersUseCase {
  constructor(private orderRepository: OrderRepository) {}

  async execute(filters?: OrderFilters): Promise<Order[]> {
    return await this.orderRepository.findAll(filters);
  }
}
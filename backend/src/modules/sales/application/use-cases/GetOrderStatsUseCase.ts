import { OrderRepository, OrderStats } from '../../domain/repositories/OrderRepository';

export class GetOrderStatsUseCase {
  constructor(private orderRepository: OrderRepository) {}

  async execute(organizationId: string): Promise<OrderStats> {
    return await this.orderRepository.getStats(organizationId);
  }
}
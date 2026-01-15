import { Order } from '../entities/Order';
import { OrderNumber } from '../value-objects/OrderNumber';

export interface OrderFilters {
  customerId?: string;
  organizationId?: string;
  status?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customer?: string;
}

export interface OrderStats {
  total: number;
  totalValue: number;
  byStatus: Record<string, { count: number; value: number }>;
  avgOrderValue: number;
  monthlyGrowth: number;
  pendingValue: number;
  overdueCount: number;
}

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByOrderNumber(orderNumber: OrderNumber): Promise<Order | null>;
  findAll(filters?: OrderFilters): Promise<Order[]>;
  delete(id: string): Promise<void>;
  getNextSequence(): Promise<number>;
  getStats(organizationId: string): Promise<OrderStats>;
  findExpiredOrders(organizationId: string): Promise<Order[]>;
}
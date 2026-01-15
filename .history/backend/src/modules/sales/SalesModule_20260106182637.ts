import { FastifyInstance } from 'fastify';
import { PrismaOrderRepository } from './infrastructure/repositories/PrismaOrderRepository';
import { CreateOrderUseCase } from './application/use-cases/CreateOrderUseCase';
import { GetOrderUseCase } from './application/use-cases/GetOrderUseCase';
import { ListOrdersUseCase } from './application/use-cases/ListOrdersUseCase';
import { UpdateOrderStatusUseCase } from './application/use-cases/UpdateOrderStatusUseCase';
import { GetOrderStatsUseCase } from './application/use-cases/GetOrderStatsUseCase';
import { OrderController } from './presentation/http/OrderController';
import { orderRoutes } from './presentation/http/routes';
import { PricingEngine } from '../../shared/application/pricing/PricingEngine';

// Interfaces para serviços externos (implementados em outros módulos)
export interface CustomerService {
  findById(id: string): Promise<{ id: string; organizationId: string } | null>;
}

export interface ProductService {
  findById(id: string): Promise<any | null>;
}

export interface OrganizationService {
  getSettings(organizationId: string): Promise<any | null>;
}

export class SalesModule {
  private orderRepository!: PrismaOrderRepository;
  private createOrderUseCase!: CreateOrderUseCase;
  private getOrderUseCase!: GetOrderUseCase;
  private listOrdersUseCase!: ListOrdersUseCase;
  private updateOrderStatusUseCase!: UpdateOrderStatusUseCase;
  private orderController!: OrderController;
  private pricingEngine!: PricingEngine;

  constructor(
    private prisma: any,
    private customerService: CustomerService,
    private productService: ProductService,
    private organizationService: OrganizationService
  ) {
    this.setupDependencies();
  }

  private setupDependencies(): void {
    // Infrastructure
    this.orderRepository = new PrismaOrderRepository(this.prisma);
    this.pricingEngine = new PricingEngine();

    // Use Cases
    this.createOrderUseCase = new CreateOrderUseCase(
      this.orderRepository,
      this.customerService,
      this.productService,
      this.organizationService,
      this.pricingEngine
    );
    
    this.getOrderUseCase = new GetOrderUseCase(this.orderRepository);
    this.listOrdersUseCase = new ListOrdersUseCase(this.orderRepository);
    this.updateOrderStatusUseCase = new UpdateOrderStatusUseCase(this.orderRepository);

    // Controllers
    this.orderController = new OrderController(
      this.createOrderUseCase,
      this.getOrderUseCase,
      this.listOrdersUseCase,
      this.updateOrderStatusUseCase
    );
  }

  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    await orderRoutes(fastify, this.orderController);
  }

  // Getters para acesso aos use cases (se necessário para outros módulos)
  getCreateOrderUseCase(): CreateOrderUseCase {
    return this.createOrderUseCase;
  }

  getOrderRepository(): PrismaOrderRepository {
    return this.orderRepository;
  }
}
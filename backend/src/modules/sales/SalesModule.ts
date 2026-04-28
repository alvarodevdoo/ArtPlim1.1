import { FastifyInstance } from 'fastify';
import { PrismaOrderRepository } from './infrastructure/repositories/PrismaOrderRepository';
import { CreateOrderUseCase } from './application/use-cases/CreateOrderUseCase';
import { UpdateOrderUseCase } from './application/use-cases/UpdateOrderUseCase';
import { GetOrderUseCase } from './application/use-cases/GetOrderUseCase';
import { ListOrdersUseCase } from './application/use-cases/ListOrdersUseCase';
import { UpdateOrderStatusUseCase } from './application/use-cases/UpdateOrderStatusUseCase';
import { GetOrderStatsUseCase } from './application/use-cases/GetOrderStatsUseCase';
import { CancelOrderItemsUseCase } from './application/use-cases/CancelOrderItemsUseCase';
import { CreateDeliveryUseCase } from './application/use-cases/CreateDeliveryUseCase';
import { OrderController } from './presentation/http/OrderController';
import { AuthorizationController } from './presentation/http/AuthorizationController';
import { orderRoutes } from './presentation/http/routes';
import { PricingEngine } from '../../shared/application/pricing/PricingEngine';
import { ProcessStatusService } from '../organization/services/ProcessStatusService';

// Novos Serviços para Migração
import { ApproveOrderService } from './application/ApproveOrderService';
import { FinishOrderService } from './application/FinishOrderService';
import { ReopenOrderService } from './application/ReopenOrderService';
import { RegenerateProductionService } from './application/RegenerateProductionService';
import { ReportWasteService } from './application/ReportWasteService';
import { PricingCompositionService } from '../catalog/services/PricingCompositionService';
import { IncompatibilityService } from '../catalog/services/IncompatibilityService';
import { InventoryValuationService } from '../../shared/services/InventoryValuationService';
import { AuthorizationService } from './services/AuthorizationService';

// Interfaces para serviços externos
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
  private updateOrderUseCase!: UpdateOrderUseCase;
  private getOrderUseCase!: GetOrderUseCase;
  private listOrdersUseCase!: ListOrdersUseCase;
  private updateOrderStatusUseCase!: UpdateOrderStatusUseCase;
  private getOrderStatsUseCase!: GetOrderStatsUseCase;
  private cancelOrderItemsUseCase!: CancelOrderItemsUseCase;
  private createDeliveryUseCase!: CreateDeliveryUseCase;
  private orderController!: OrderController;
  private pricingEngine!: PricingEngine;
  private processStatusService!: ProcessStatusService;
  private authorizationService!: AuthorizationService;
  private authorizationController!: AuthorizationController;

  // Serviços Adicionais
  private approveOrderService!: ApproveOrderService;
  private finishOrderService!: FinishOrderService;
  private reopenOrderService!: ReopenOrderService;
  private regenerateProductionService!: RegenerateProductionService;
  private reportWasteService!: ReportWasteService;
  private pricingCompositionService!: PricingCompositionService;
  private incompatibilityService!: IncompatibilityService;

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
    this.processStatusService = new ProcessStatusService();

    const valuationService = new InventoryValuationService(this.prisma);

    // Use Cases & Services
    this.createOrderUseCase = new CreateOrderUseCase(
      this.orderRepository,
      this.customerService,
      this.productService,
      this.organizationService,
      this.processStatusService,
      this.pricingEngine
    );

    this.updateOrderUseCase = new UpdateOrderUseCase(
      this.orderRepository,
      this.customerService,
      this.productService,
      this.organizationService,
      this.pricingEngine,
      undefined, // PendingChangesService
      this.prisma
    );

    this.getOrderUseCase = new GetOrderUseCase(this.orderRepository);
    this.listOrdersUseCase = new ListOrdersUseCase(this.orderRepository);
    this.updateOrderStatusUseCase = new UpdateOrderStatusUseCase(
      this.orderRepository,
      this.prisma,
      this.processStatusService
    );
    this.getOrderStatsUseCase = new GetOrderStatsUseCase(this.orderRepository);
    this.cancelOrderItemsUseCase = new CancelOrderItemsUseCase(this.prisma);
    this.createDeliveryUseCase = new CreateDeliveryUseCase(this.prisma);

    // Serviços de Transição
    this.approveOrderService = new ApproveOrderService(this.prisma);
    this.finishOrderService = new FinishOrderService(this.prisma);
    this.reopenOrderService = new ReopenOrderService(this.prisma);
    this.regenerateProductionService = new RegenerateProductionService(this.prisma);
    this.reportWasteService = new ReportWasteService(this.prisma, valuationService);
    this.pricingCompositionService = new PricingCompositionService(this.prisma);
    this.incompatibilityService = new IncompatibilityService(this.prisma);

    // Controller
    this.orderController = new OrderController(
      this.createOrderUseCase,
      this.updateOrderUseCase,
      this.getOrderUseCase,
      this.listOrdersUseCase,
      this.updateOrderStatusUseCase,
      this.getOrderStatsUseCase,
      this.cancelOrderItemsUseCase,
      this.createDeliveryUseCase,
      this.approveOrderService,
      this.finishOrderService,
      this.reopenOrderService,
      this.regenerateProductionService,
      this.reportWasteService,
      this.pricingCompositionService,
      this.incompatibilityService
    );

    this.authorizationService = new AuthorizationService();
    this.authorizationController = new AuthorizationController(this.authorizationService);
  }

  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    await orderRoutes(fastify, this.orderController, this.authorizationController);
  }

  getCreateOrderUseCase(): CreateOrderUseCase {
    return this.createOrderUseCase;
  }

  getOrderRepository(): PrismaOrderRepository {
    return this.orderRepository;
  }
}
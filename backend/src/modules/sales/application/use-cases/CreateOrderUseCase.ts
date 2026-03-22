import { addDays } from 'date-fns';
import { Order } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { OrderNumber } from '../../domain/value-objects/OrderNumber';
import { OrderStatus } from '../../domain/value-objects/OrderStatus';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';
import { PricingEngine } from '../../../../shared/application/pricing/PricingEngine';
import { NotFoundError } from '../../../../shared/infrastructure/errors/AppError';
import { CreateOrderDTO } from '../dto/CreateOrderDTO';

export interface CustomerService {
  findById(id: string): Promise<{ id: string; organizationId: string } | null>;
}

export interface ProcessStatusService {
  ensureDefaultStatuses(organizationId: string): Promise<void>;
  list(organizationId: string): Promise<any[]>;
}

export interface ProductService {
  findById(id: string): Promise<any | null>;
}

export interface OrganizationService {
  getSettings(organizationId: string): Promise<any | null>;
}

export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private customerService: CustomerService,
    private productService: ProductService,
    private organizationService: OrganizationService,
    private processStatusService: ProcessStatusService, // Injetar serviço
    private pricingEngine: PricingEngine
  ) { }

  async execute(data: CreateOrderDTO): Promise<Order> {
    // Verificar se o cliente existe
    const customer = await this.customerService.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError('Cliente');
    }

    // Buscar configurações da organização
    const settings = await this.organizationService.getSettings(customer.organizationId);
    const validadeOrcamento = settings?.validadeOrcamento || 7; // padrão 7 dias

    // Garantir e buscar status padrão
    await this.processStatusService.ensureDefaultStatuses(customer.organizationId);
    const statuses = await this.processStatusService.list(customer.organizationId);
    // Encontrar o status que mapeia para DRAFT (Rascunho)
    const initialStatus = statuses.find((s: any) => s.mappedBehavior === 'DRAFT') || statuses[0];

    // Gerar número do pedido
    const sequence = await this.orderRepository.getNextSequence();
    const orderNumber = OrderNumber.generate(sequence);

    // Calcular validade do orçamento
    const now = new Date();
    const validUntil = addDays(now, validadeOrcamento);

    // Processar itens
    const orderItems: OrderItem[] = [];

    for (const itemData of data.items) {
      // Buscar produto
      const product = await this.productService.findById(itemData.productId);
      if (!product) {
        throw new NotFoundError(`Produto ${itemData.productId}`);
      }

      const selectedOptions = itemData.attributes?.selectedOptions || {};
      const selectedOptionIds = Object.values(selectedOptions).filter(id => !!id) as string[];

      // Calcular preços usando o novo PricingEngine
      const pricing = await this.pricingEngine.execute({
        productId: product.id,
        width: itemData.width,
        height: itemData.height,
        quantity: itemData.quantity,
        variables: itemData.attributes?.dynamicVariables || itemData.attributes || {}, // Tentar extrair variáveis dinâmicas
        selectedOptionIds,
        organizationId: customer.organizationId
      });

      // Usar preço customizado se fornecido, senão usar o calculado
      const unitPrice = itemData.unitPrice || pricing.unitPrice;


      // Unificar atributos e adicionar o snapshot histórico de materiais
      const attributes = {
        ...(itemData.attributes || {}),
        insumos_snapshot: pricing.insumos, // SNAPSHOT HISTÓRICO DE MATERIAIS
      };

      console.log(`[CreateOrderUseCase] Item - Prod: ${product.id} | DTO Rule: ${itemData.pricingRuleId} | Prod Rule: ${product.pricingRuleId}`);

      const orderItem = new OrderItem({
        productId: itemData.productId,
        dimensions: new Dimensions(itemData.width, itemData.height),
        quantity: itemData.quantity,
        costPrice: new Money(pricing.costPrice),
        calculatedPrice: new Money(pricing.unitPrice),
        unitPrice: new Money(unitPrice),
        notes: itemData.notes,
        attributes, 
        pricingRuleId: itemData.pricingRuleId || product.pricingRuleId, // VINCULAR VERSÃO HISTÓRICA OU ATUAL DA REGRA

        // Campos específicos por tipo
        area: itemData.area,
        paperSize: itemData.paperSize,
        paperType: itemData.paperType,
        printColors: itemData.printColors,
        finishing: itemData.finishing,
        machineTime: itemData.machineTime,
        setupTime: itemData.setupTime,
        complexity: itemData.complexity,

        // Tamanho personalizado
        customSizeName: itemData.customSizeName,
        isCustomSize: itemData.isCustomSize
      });

      orderItems.push(orderItem);
    }

    // Calcular subtotal
    const subtotal = orderItems.reduce(
      (sum, item) => sum.add(item.totalPrice),
      Money.zero()
    );

    // Criar pedido
    const order = Order.create({
      orderNumber,
      customerId: data.customerId,
      organizationId: customer.organizationId,
      status: OrderStatus.draft(),
      processStatusId: initialStatus?.id, // Adicionar status customizado inicial
      items: orderItems,
      subtotal,
      discount: Money.zero(),
      tax: Money.zero(),
      total: subtotal,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      validUntil,
      notes: data.notes || undefined
    });

    // Salvar no repositório
    return await this.orderRepository.save(order);
  }
}
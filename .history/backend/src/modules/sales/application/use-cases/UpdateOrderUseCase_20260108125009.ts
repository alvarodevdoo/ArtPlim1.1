import { addDays } from 'date-fns';
import { Order } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';
import { PricingEngine } from '../../../../shared/application/pricing/PricingEngine';
import { NotFoundError, ValidationError } from '../../../../shared/infrastructure/errors/AppError';
import { CreateOrderDTO } from '../dto/CreateOrderDTO';

export interface CustomerService {
  findById(id: string): Promise<{ id: string; organizationId: string } | null>;
}

export interface ProductService {
  findById(id: string): Promise<any | null>;
}

export interface OrganizationService {
  getSettings(organizationId: string): Promise<any | null>;
}

export class UpdateOrderUseCase {
  constructor(  
    private orderRepository: OrderRepository,
    private customerService: CustomerService,
    private productService: ProductService,
    private organizationService: OrganizationService,
    private pricingEngine: PricingEngine
  ) {}

  async execute(orderId: string, data: CreateOrderDTO): Promise<Order> {
    // Buscar pedido existente
    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError('Pedido');
    }

    // Verificar se o pedido pode ser editado (todos os status exceto DELIVERED)
    if (existingOrder.status.value === 'DELIVERED') {
      throw new ValidationError('Pedidos entregues não podem ser editados');
    }

    // Verificar se o cliente existe
    const customer = await this.customerService.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError('Cliente');
    }

    // Buscar configurações da organização
    const settings = await this.organizationService.getSettings(customer.organizationId);
    const validadeOrcamento = settings?.validadeOrcamento || 7; // padrão 7 dias

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

      // Calcular preços usando o PricingEngine
      const pricing = await this.pricingEngine.execute({
        product: {
          id: product.id,
          name: product.name,
          pricingMode: product.pricingMode,
          salePrice: product.salePrice ? Number(product.salePrice) : undefined,
          minPrice: product.minPrice ? Number(product.minPrice) : undefined,
          markup: product.markup
        },
        width: itemData.width,
        height: itemData.height,
        quantity: itemData.quantity,
        organizationSettings: settings ? {
          enableEngineering: settings.enableEngineering,
          defaultMarkup: settings.defaultMarkup
        } : undefined
      });

      // Usar preço customizado se fornecido, senão usar o calculado
      const unitPrice = itemData.unitPrice || pricing.unitPrice;

      const orderItem = new OrderItem({
        productId: itemData.productId,
        dimensions: new Dimensions(itemData.width, itemData.height),
        quantity: itemData.quantity,
        costPrice: new Money(pricing.costPrice),
        calculatedPrice: new Money(pricing.calculatedPrice),
        unitPrice: new Money(unitPrice),
        notes: itemData.notes,
        
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

    // Atualizar pedido existente
    existingOrder.updateDetails({
      customerId: data.customerId,
      items: orderItems,
      subtotal,
      total: subtotal, // Mantendo discount e tax zerados por enquanto
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      validUntil,
      notes: data.notes || undefined
    });

    // Salvar no repositório
    return await this.orderRepository.save(existingOrder);
  }
}
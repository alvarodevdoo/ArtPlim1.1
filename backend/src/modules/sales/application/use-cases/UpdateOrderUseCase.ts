import { addDays } from 'date-fns';
import { Order } from '../../domain/entities/Order';
import { OrderItem, DiscountStatus } from '../../domain/entities/OrderItem';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { OrderStatusEnum } from '../../domain/value-objects/OrderStatus';
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';
import { PricingEngine } from '../../../../shared/application/pricing/PricingEngine';
import { NotFoundError, ValidationError } from '../../../../shared/infrastructure/errors/AppError';
import { CreateOrderDTO } from '../dto/CreateOrderDTO';
import { PendingChangesService } from '../../../production/services/PendingChangesService';
import { DiscountService, DiscountItemInput } from '../../domain/services/DiscountService';
import { CommissionService } from '../../domain/services/CommissionService';

export interface CustomerService {
  findById(id: string): Promise<{ id: string; organizationId: string } | null>;
}

export interface ProductService {
  findById(id: string): Promise<any | null>;
}

export interface OrganizationService {
  getSettings(organizationId: string): Promise<any | null>;
}

export interface UpdateOrderResult {
  order: Order;
  hasPendingChanges?: boolean;
  pendingChangeId?: string;
}

export class UpdateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private customerService: CustomerService,
    private productService: ProductService,
    private organizationService: OrganizationService,
    private pricingEngine: PricingEngine,
    private pendingChangesService?: PendingChangesService,
    private prisma?: any // Injetar prisma para buscar status
  ) { }

  async execute(orderId: string, data: CreateOrderDTO, userId: string): Promise<UpdateOrderResult> {
    // Buscar pedido existente
    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError('Pedido');
    }

    // Verificar se o pedido pode ser editado (todos os status exceto DELIVERED)
    // Verificar se o pedido pode ser editado (todos os status exceto DELIVERED)
    if (existingOrder.status.value === 'DELIVERED') {
      throw new ValidationError('Pedidos entregues não podem ser editados');
    }

    // Validação de Trava de Edição (Custom Status)
    if (existingOrder.processStatusId && this.prisma) {
      const currentProcessStatus = await this.prisma.processStatus.findUnique({
        where: { id: existingOrder.processStatusId }
      });

      if (currentProcessStatus && currentProcessStatus.allowEdition === false) {
        throw new ValidationError(`O pedido não pode ser editado no status atual: ${currentProcessStatus.name}`);
      }
    }

    // Se o pedido está em produção e temos o serviço de alterações pendentes, criar solicitação
    if (existingOrder.status.value === 'IN_PRODUCTION' && this.pendingChangesService) {
      return await this.handleProductionOrderChange(existingOrder, data, userId);
    }

    // Para outros status, aplicar alterações normalmente
    return await this.applyChangesDirectly(existingOrder, data);
  }

  private async handleProductionOrderChange(
      existingOrder: Order,
      data: CreateOrderDTO,
      userId: string
    ): Promise<UpdateOrderResult> {
    // Calcular as alterações necessárias
    const changes = await this.calculateChanges(existingOrder, data);

    if (Object.keys(changes).length === 0) {
      // Nenhuma alteração detectada
      return { order: existingOrder };
    }

    // Criar solicitação de alteração pendente
    const pendingChange = await this.pendingChangesService!.createPendingChange({
      orderId: existingOrder.id!,
      changes,
      requestedBy: userId,
      organizationId: existingOrder.organizationId,
      reason: 'Alteração solicitada durante produção'
    });

    return {
      order: existingOrder,
      hasPendingChanges: true,
      pendingChangeId: pendingChange.id
    };
  }

  private async applyChangesDirectly(existingOrder: Order, data: CreateOrderDTO): Promise<UpdateOrderResult> {
    // Verificar se o cliente existe
    const customer = await this.customerService.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError('Cliente');
    }

    // Buscar configurações da organização
    const settings = await this.organizationService.getSettings(customer.organizationId);
    const validadeOrcamento = settings?.validadeOrcamento || 7;

    const org = await this.prisma?.organization.findUnique({
      where: { id: customer.organizationId },
      select: { defaultCommissionRate: true, maxDiscountThreshold: true }
    });
    const defaultCommissionRate = org?.defaultCommissionRate ? Number(org.defaultCommissionRate) : 0;
    const maxDiscountThreshold = org?.maxDiscountThreshold !== null && org?.maxDiscountThreshold !== undefined 
      ? Number(org.maxDiscountThreshold) 
      : 0.15;

    const now = new Date();
    const validUntil = addDays(now, validadeOrcamento);

    const orderItems: OrderItem[] = [];
    const discountInputs: DiscountItemInput[] = [];
    const productsInfo = new Map<string, { isCommissionable: boolean; specificCommissionRate: number | null }>();

    for (let index = 0; index < data.items.length; index++) {
      const itemData = data.items[index];
      const product = await this.productService.findById(itemData.productId);
      if (!product) {
        throw new NotFoundError(`Produto ${itemData.productId}`);
      }

      const dbProduct = await this.prisma?.product.findUnique({
        where: { id: product.id },
        select: { isCommissionable: true, specificCommissionRate: true }
      });
      productsInfo.set(itemData.productId, {
        isCommissionable: dbProduct?.isCommissionable ?? true,
        specificCommissionRate: dbProduct?.specificCommissionRate ? Number(dbProduct.specificCommissionRate) : null
      });

      const selectedOptions = itemData.attributes?.selectedOptions || {};
      const selectedOptionIds = Object.values(selectedOptions).filter(id => !!id) as string[];

      // Calcular preços usando o novo PricingEngine
      const pricing = await this.pricingEngine.execute({
        productId: product.id,
        width: itemData.width,
        height: itemData.height,
        quantity: itemData.quantity,
        variables: itemData.attributes?.dynamicVariables || itemData.attributes || {}, 
        selectedOptionIds,
        organizationId: customer.organizationId
      });

      // Usar preço customizado se fornecido, senão usar o calculado
      const unitPrice = itemData.unitPrice || pricing.unitPrice;


      // Unificar atributos e adicionar o snapshot histórico de materiais
      const attributes = {
        ...(itemData.attributes || {}),
        insumos_snapshot: pricing.insumos
      };

      // Tenta encontrar o item correspondente no pedido existente para preservar o status
      const existingItem = existingOrder.items.find(ei => ei.productId === itemData.productId && ei.quantity === itemData.quantity);

      const orderItem = new OrderItem({
        id: itemData.id, // Preservar ID se enviado
        productId: itemData.productId,
        dimensions: new Dimensions(itemData.width, itemData.height),
        quantity: itemData.quantity,
        costPrice: new Money(pricing.costPrice),
        calculatedPrice: new Money(pricing.unitPrice),
        unitPrice: new Money(unitPrice),
        notes: itemData.notes,
        attributes, // Salvar snapshot

        // Preservar status se o item já existia
        status: itemData.status || existingItem?.status || OrderStatusEnum.DRAFT,
        processStatusId: itemData.processStatusId || existingItem?.processStatusId,

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
        isCustomSize: itemData.isCustomSize,
        pricingRuleId: itemData.pricingRuleId || product.pricingRuleId,
        discountStatus: (itemData.discountStatus as DiscountStatus) || DiscountStatus.NONE
      });

      orderItems.push(orderItem);

      discountInputs.push({
        id: index.toString(),
        unitPrice: Number(unitPrice),
        quantity: itemData.quantity,
        discountItem: itemData.discount || 0,
        discountStatus: itemData.discountStatus
      });
    }

    const discountService = new DiscountService();
    const commissionService = new CommissionService();

    const globalDiscount = data.globalDiscount || 0;

    const discountOutputs = discountService.execute({
      items: discountInputs,
      globalDiscount,
      maxDiscountThreshold,
      globalDiscountStatus: data.discountStatus
    });

    discountOutputs.forEach((output, index) => {
      const orderItem = orderItems[index];
      const productInfo = productsInfo.get(orderItem.productId);

      orderItem.applyDiscount(
        new Money(output.discountItem),
        new Money(output.discountGlobal)
      );

      const commissionOutput = commissionService.execute({
        netPrice: output.netPrice,
        isCommissionable: productInfo?.isCommissionable ?? true,
        specificCommissionRate: productInfo?.specificCommissionRate,
        defaultCommissionRate
      });

      orderItem.applyCommission(
        commissionOutput.commissionRateApplied,
        new Money(commissionOutput.commissionAmount)
      );
    });

    // Calcular subtotais e totais finais
    const subtotal = orderItems.reduce(
      (sum, item) => sum.add(item.unitPrice.multiply(item.quantity)),
      Money.zero()
    );

    const totalDiscounts = orderItems.reduce(
      (sum, item) => sum.add(item.discountItem).add(item.discountGlobal),
      Money.zero()
    );

    const total = subtotal.subtract(totalDiscounts);

    // Atualizar pedido existente
    existingOrder.updateDetails({
      customerId: data.customerId,
      items: orderItems,
      subtotal,
      total,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      validUntil,
      notes: data.notes || undefined,
      discountStatus: (data.discountStatus as DiscountStatus) || DiscountStatus.NONE
    });

    // O desconto precisa ser aplicado aqui também, para atualizar _discount
    existingOrder.applyDiscount(totalDiscounts);

    // Salvar no repositório
    const updatedOrder = await this.orderRepository.save(existingOrder);

    return { order: updatedOrder };
  }

  private async calculateChanges(existingOrder: Order, newData: CreateOrderDTO): Promise<Record<string, any>> {
    const changes: Record<string, any> = {};

    // Comparar campos do pedido principal
    if (newData.customerId !== existingOrder.customerId) {
      changes.customerId = newData.customerId;
    }

    if (newData.deliveryDate) {
      const newDeliveryDate = new Date(newData.deliveryDate);
      const existingDeliveryDate = existingOrder.deliveryDate;

      if (!existingDeliveryDate || newDeliveryDate.getTime() !== existingDeliveryDate.getTime()) {
        changes.deliveryDate = newDeliveryDate;
      }
    }

    if (newData.notes !== existingOrder.notes) {
      changes.notes = newData.notes;
    }

    // Comparar itens (simplificado - detecta se há diferenças)
    const existingItemsCount = existingOrder.items.length;
    const newItemsCount = newData.items.length;

    if (existingItemsCount !== newItemsCount) {
      changes.itemsCount = newItemsCount;
    }

    // Comparar itens individuais (implementação básica)
    for (let i = 0; i < Math.min(existingItemsCount, newItemsCount); i++) {
      const existingItem = existingOrder.items[i];
      const newItem = newData.items[i];

      if (existingItem.quantity !== newItem.quantity) {
        changes[`item_${existingItem.id || i}_quantity`] = newItem.quantity;
      }

      if (existingItem.dimensions.width !== newItem.width) {
        changes[`item_${existingItem.id || i}_width`] = newItem.width;
      }

      if (existingItem.dimensions.height !== newItem.height) {
        changes[`item_${existingItem.id || i}_height`] = newItem.height;
      }

      if (newItem.unitPrice && existingItem.unitPrice.value !== newItem.unitPrice) {
        changes[`item_${existingItem.id || i}_unitPrice`] = newItem.unitPrice;
      }

      if (existingItem.notes !== newItem.notes) {
        changes[`item_${existingItem.id || i}_notes`] = newItem.notes;
      }
    }

    return changes;
  }
}
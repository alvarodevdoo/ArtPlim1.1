import { addDays } from 'date-fns';
import { StockReservationService } from '../../../wms/services/StockReservationService';
import { Order } from '../../domain/entities/Order';
import { OrderItem, DiscountStatus } from '../../domain/entities/OrderItem';
import { OrderNumber } from '../../domain/value-objects/OrderNumber';
import { OrderStatus } from '../../domain/value-objects/OrderStatus';
import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';
import { PricingEngine } from '../../../../shared/application/pricing/PricingEngine';
import { NotFoundError } from '../../../../shared/infrastructure/errors/AppError';
import { CreateOrderDTO } from '../dto/CreateOrderDTO';
import { DiscountService, DiscountItemInput } from '../../domain/services/DiscountService';
import { CommissionService } from '../../domain/services/CommissionService';

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
    private pricingEngine: PricingEngine,
    private prisma: any // Injetar prisma
  ) { }

  async execute(data: CreateOrderDTO, userId: string = 'SYSTEM'): Promise<Order> {
    // Verificar se o cliente existe
    const customer = await this.customerService.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError('Cliente');
    }

    // Buscar configurações da organização
    const settings = await this.organizationService.getSettings(customer.organizationId);
    const validadeOrcamento = settings?.validadeOrcamento || 7; // padrão 7 dias

    // Obter limites e taxas padrão da Organização para descontos e comissões
    const org = await (this as any).prisma?.organization.findUnique({
      where: { id: customer.organizationId },
      select: { defaultCommissionRate: true, maxDiscountThreshold: true }
    });
    const defaultCommissionRate = org?.defaultCommissionRate ? Number(org.defaultCommissionRate) : 0;
    const maxDiscountThreshold = org?.maxDiscountThreshold !== null && org?.maxDiscountThreshold !== undefined 
      ? Number(org.maxDiscountThreshold) 
      : 0.15; // fallback 15% somente se for null/undefined

    // Garantir e buscar status padrão
    await this.processStatusService.ensureDefaultStatuses(customer.organizationId);
    const statuses = await this.processStatusService.list(customer.organizationId);
    // Encontrar o status que mapeia para DRAFT (Rascunho)
    const initialStatus = statuses.find((s: any) => s.mappedBehavior === 'DRAFT') || statuses[0];

    // Gerar número do pedido
    const sequence = await this.orderRepository.getNextSequence(customer.organizationId);
    const orderNumber = OrderNumber.generate(sequence);

    // Calcular validade do orçamento
    const now = new Date();
    const validUntil = addDays(now, validadeOrcamento);

    // Processar itens
    const orderItems: OrderItem[] = [];
    const discountInputs: DiscountItemInput[] = [];
    const productsInfo = new Map<string, { isCommissionable: boolean; specificCommissionRate: number | null }>();

    for (let index = 0; index < data.items.length; index++) {
      const itemData = data.items[index];
      // Buscar produto
      const product = await this.productService.findById(itemData.productId);
      if (!product) {
        throw new NotFoundError(`Produto ${itemData.productId}`);
      }

      // Buscar as regras de comissão (pois productService.findById pode não trazer os campos novos)
      const dbProduct = await (this as any).prisma?.product.findUnique({
        where: { id: product.id },
        select: { isCommissionable: true, specificCommissionRate: true, maxDiscountThreshold: true }
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
        isCustomSize: itemData.isCustomSize,
        discountStatus: (itemData.discountStatus as DiscountStatus) || DiscountStatus.NONE
      });

      orderItems.push(orderItem);

      // Adicionar aos inputs de desconto (usando id temporário)
      discountInputs.push({
        id: index.toString(),
        unitPrice: Number(unitPrice),
        quantity: itemData.quantity,
        discountItem: itemData.discount || 0,
        discountStatus: itemData.discountStatus,
        maxDiscountThreshold: dbProduct?.maxDiscountThreshold !== null && dbProduct?.maxDiscountThreshold !== undefined ? Number(dbProduct.maxDiscountThreshold) : undefined
      });
    }

    // --- APPLY DISCOUNTS AND COMMISSIONS ---
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

      // Aplicar descontos no item
      orderItem.applyDiscount(
        new Money(output.discountItem),
        new Money(output.discountGlobal)
      );

      // Calcular e aplicar comissões
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
    // ----------------------------------------

    // Acumular consumo total de materiais de todos os itens (para reserva)
    const materialConsumptionMap = new Map<string, number>();

    // 1) Materiais vindos do insumos_snapshot (BOM via Ficha Técnica + opções)
    for (const orderItem of orderItems) {
      const snap: any[] = (orderItem.attributes as any)?.insumos_snapshot || [];
      for (const insumo of snap) {
        if (!insumo?.id) continue;
        const prev = materialConsumptionMap.get(insumo.id) || 0;
        materialConsumptionMap.set(insumo.id, prev + (insumo.quantidade || 0));
      }
    }

    // 2) Materiais vinculados diretamente às OPÇÕES de configuração (ConfigurationOption.materialId)
    //    Ex: cor "KIWI-TRANSPARENTE" -> material "Carimbo Printer C20 Kiwi"
    const allOptionIds = orderItems.flatMap((oi: any) => {
      const sel = (oi.attributes as any)?.selectedOptions || {};
      return Object.values(sel).filter((v: any) => !!v);
    }) as string[];

    if (allOptionIds.length > 0) {
      const opts = await (this as any).prisma.configurationOption.findMany({
        where: { id: { in: allOptionIds }, materialId: { not: null } },
        select: { id: true, materialId: true, slotQuantity: true }
      });
      const optMap = new Map<string, { materialId: string; slotQuantity: number }>(
        opts.map((o: any) => [o.id, { materialId: o.materialId, slotQuantity: Number(o.slotQuantity || 1) }])
      );

      for (const oi of orderItems) {
        const sel: Record<string, string> = (oi.attributes as any)?.selectedOptions || {};
        for (const optId of Object.values(sel)) {
          const info = optMap.get(optId);
          if (!info?.materialId) continue;
          const qty = info.slotQuantity * oi.quantity;
          const prev = materialConsumptionMap.get(info.materialId) || 0;
          materialConsumptionMap.set(info.materialId, prev + qty);
        }
      }
    }

    // Calcular subtotais e totais finais (Bruto)
    const subtotal = orderItems.reduce(
      (sum, item) => sum.add(item.unitPrice.multiply(item.quantity)),
      Money.zero()
    );

    const totalDiscounts = orderItems.reduce(
      (sum, item) => sum.add(item.discountItem).add(item.discountGlobal),
      Money.zero()
    );

    const total = subtotal.subtract(totalDiscounts);

    // Criar pedido
    const order = Order.create({
      orderNumber,
      customerId: data.customerId,
      organizationId: customer.organizationId,
      status: OrderStatus.draft(),
      processStatusId: initialStatus?.id, // Adicionar status customizado inicial
      items: orderItems,
      subtotal,
      discount: totalDiscounts,
      tax: Money.zero(),
      total,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      validUntil,
      notes: data.notes || undefined,
      discountStatus: (data.discountStatus as DiscountStatus) || DiscountStatus.NONE,
      sellerId: userId !== 'SYSTEM' ? userId : undefined,
      artDesignerId: data.artDesignerId,
      productionUserId: data.productionUserId,
      packagingUserId: data.packagingUserId
    });

    // Salvar no repositório
    const savedOrder = await this.orderRepository.save(order);

    // Reservar estoque (produtos com stockQuantity + materiais usados na composição)
    try {
      const reservationService = new StockReservationService((this as any).prisma);
      await reservationService.reserveForOrder(
        savedOrder.id,
        customer.organizationId,
        data.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        materialConsumptionMap
      );
    } catch (reservationError: any) {
      // Se a reserva falhar, desfaz o pedido e repropaga o erro
      await (this as any).prisma.order.delete({ where: { id: savedOrder.id } }).catch(() => {});
      throw reservationError;
    }

    // Registrar no histórico de status (Criação)
    try {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: savedOrder.id,
          fromStatus: 'NONE',
          toStatus: 'DRAFT',
          notes: 'Pedido criado por Usuário',
          userId: userId
        }
      });
    } catch (historyError) {
      console.error('[CreateOrderUseCase] Erro ao registrar histórico:', historyError);
    }

    return savedOrder;
  }
}
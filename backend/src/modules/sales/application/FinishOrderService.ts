import { OrderFinanceHelper } from '../../../shared/utils/OrderFinanceHelper';
import { PricingCompositionService } from '../../catalog/services/PricingCompositionService';
import { InventoryValuationService, ValuationMethod } from '../../../shared/services/InventoryValuationService';

export interface FinishOrderInput {
  orderId: string;
  organizationId: string;
  userId: string;
  processStatusId?: string;
}

export interface FinishOrderResult {
  orderId: string;
  orderNumber: string;
  finalTotal: number;
  remainingBalance: number;
  finishedAt: Date;
}

export class FinishOrderService {
  constructor(private readonly prisma: any) {}

  async execute(input: FinishOrderInput): Promise<any> {
    const { orderId, organizationId, userId } = input;

    // ── Fase 0: Buscar pedido completo ──────
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        transactions: true,
        accountsReceivable: {
          where: { status: 'PENDING' }
        },
        items: {
          include: {
            product: true,
            configurations: {
              include: {
                selectedOption: {
                  include: {
                    material: true,
                    fichasTecnicas: { include: { material: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) throw new Error('Pedido não encontrado');

    if (order.status === 'FINISHED' || order.status === 'DELIVERED') {
      throw new Error(`Este pedido já foi finalizado anteriormente (Status: ${order.status}).`);
    }

    // Calcular o saldo devedor real final antes da finalização
    const remainingBalance = OrderFinanceHelper.calculateRemainingBalance(order);

    // ── Fase 0.5: Validar Regras de Negócio (Retirada/Faturamento) ──
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { allowDeliveryWithBalance: true, defaultDueDateDays: true }
    });

    if (settings && !settings.allowDeliveryWithBalance && remainingBalance > 0) {
      throw new Error(`PAYMENT_REQUIRED:TOTAL|Este pedido não permite retirada com saldo em aberto. Realize a quitação total de ${OrderFinanceHelper.formatCurrency(remainingBalance)} antes de finalizar.`);
    }

    const dueDateDays = settings?.defaultDueDateDays ?? 30;

    // ── Fase 1: Snapshot de fallback para pedidos legados sem unitCostAtSale
    const itemUpdates: any[] = [];
    const compositionService = new PricingCompositionService(this.prisma);
    const valuationService = new InventoryValuationService(this.prisma);
    const valuationMethod: ValuationMethod = await valuationService.getMethod(organizationId);

    for (const item of order.items) {
      if (!item.unitCostAtSale || Number(item.unitCostAtSale) === 0) {
        const selectedOptionIds = item.configurations
          .map((c: any) => c.selectedOptionId)
          .filter(Boolean);

        const composition = await compositionService.calculate({
          productId: item.productId,
          selectedOptionIds,
          quantity: item.quantity,
          width: Number(item.width || 0),
          height: Number(item.height || 0),
          dynamicVariables: ((item as any).attributes?.dynamicVariables || {}),
          organizationId
        });

        // Insumos Manuais (Attributes)
        const attributes = (item as any).attributes || {};
        const manualInsumos = Array.isArray(attributes.insumos) ? attributes.insumos : [];
        let manualCost = 0;

        for (const manual of manualInsumos) {
          const mat = await this.prisma.material.findUnique({
            where: { id: manual.insumoId },
            select: {
              id: true, name: true, averageCost: true, costPerUnit: true, purchasePrice: true,
              format: true, purchaseWidth: true, purchaseHeight: true, categoryId: true
            }
          });

          if (mat) {
            const qty = Number(manual.quantidadeUtilizada || 0) * item.quantity;
            const unitCost = await valuationService.resolveUnitCost(mat, organizationId, valuationMethod, qty);
            const cost = qty * unitCost;
            manualCost += cost;

            composition.breakdown.push({
              materialId: mat.id,
              materialName: mat.name,
              materialCategoryId: (mat as any).categoryId,
              quantity: qty,
              costPerUnit: unitCost,
              subtotal: cost,
              source: 'FICHA_TECNICA',
              optionLabel: 'Insumo Adicional (Fallback)'
            });
          }
        }

        const totalItemCost = composition.totalCost + manualCost;
        const unitCostAtSale = totalItemCost / item.quantity;
        const unitPriceAtSale = Number(item.unitPrice);

        itemUpdates.push({
          itemId: item.id,
          unitCostAtSale,
          unitPriceAtSale,
          profitAtSale: unitPriceAtSale - unitCostAtSale,
          compositionSnapshot: composition.breakdown
        });
      }
    }

    // ── Fase 2: Transação Atômica ───────────
    const finishedAt = new Date();

    await this.prisma.$transaction(async (tx: any) => {
      // 2a. Atualizar Pedido para FINISHED e definir data do DRE
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'FINISHED',
          finishedAt,
          updatedAt: new Date()
        }
      });

      // 1b. Registrar histórico de status
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'FINISHED',
          notes: 'Ciclo de produção encerrado — Venda reconhecida no DRE.',
          userId
        }
      });

      // 1c. Sincronizar Contas a Receber (AccountReceivable)
      // Buscamos se já existe um título pendente
      const pendingReceivable = order.accountsReceivable[0];

      if (remainingBalance > 0) {
        if (pendingReceivable) {
          // Ajusta o valor do título existente caso o total do pedido tenha mudado
          await tx.accountReceivable.update({
            where: { id: pendingReceivable.id },
            data: { 
              amount: remainingBalance,
              notes: (pendingReceivable.notes || '') + ` | Valor ajustado na finalização.`
            }
          });
        } else {
          // Cria um novo título se não existia nenhum pendente mas ainda há saldo
          await tx.accountReceivable.create({
            data: {
              organizationId,
              customerId: order.customerId,
              orderId,
              amount: remainingBalance,
              dueDate: order.deliveryDate ? new Date(order.deliveryDate) : new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000),
              status: 'PENDING',
              notes: `Título gerado na finalização do Pedido ${order.orderNumber}`
            }
          });
        }
      } else if (pendingReceivable) {
        // Se o saldo agora é zero mas tínhamos um título pendente, cancelamos ele
        await tx.accountReceivable.update({
          where: { id: pendingReceivable.id },
          data: { 
            status: 'CANCELLED',
            notes: (pendingReceivable.notes || '') + ` | Cancelado na finalização pois o saldo é zero.`
          }
        });
      }

      // 2d. Atualizar itens (Snapshots de Fallback passados)
      for (const update of itemUpdates) {
        await tx.orderItem.update({
          where: { id: update.itemId },
          data: {
            unitCostAtSale: update.unitCostAtSale,
            unitPriceAtSale: update.unitPriceAtSale,
            profitAtSale: update.profitAtSale,
            compositionSnapshot: update.compositionSnapshot as any
          }
        });
      }
    });

    // ── Fase 3: Retorno Sincronizado ──────────
    return await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
        processStatus: true,
        transactions: true,
        accountsReceivable: true
      }
    });
  }
}

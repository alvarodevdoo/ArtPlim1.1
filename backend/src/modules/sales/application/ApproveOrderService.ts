import { OrderFinanceHelper } from '../../../shared/utils/OrderFinanceHelper';

/**
 * ApproveOrderService
 * 
 * Responsabilidade: Aprovar o pedido, garantindo reserva de estoque,
 * geração de OPs e criação do Contas a Receber inicial.
 * 
 * Este serviço NÃO reconhece receita no DRE (Competência). 
 * Isso acontecerá apenas no FinishOrderService.
 */

import { PricingCompositionService, CompositionLineItem } from '../../catalog/services/PricingCompositionService';
import { IncompatibilityService } from '../../catalog/services/IncompatibilityService';
import { OPGeneratorService } from '../../production/services/OPGeneratorService';
import { InventoryValuationService, ValuationMethod } from '../../../shared/services/InventoryValuationService';
import { StatusEngine } from '../domain/services/StatusEngine';

export interface ApproveOrderInput {
  orderId: string;
  organizationId: string;
  userId: string;
  processStatusId?: string;
}

export interface ApproveOrderResult {
  orderId: string;
  orderNumber: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  stockMovementsCreated: number;
  warnings: string[];
}

export class ApproveOrderService {
  private compositionService: PricingCompositionService;
  private incompatibilityService: IncompatibilityService;
  private valuationService: InventoryValuationService;
  private statusEngine: StatusEngine;

  constructor(private readonly prisma: any) {
    this.compositionService = new PricingCompositionService(prisma);
    this.incompatibilityService = new IncompatibilityService(prisma);
    this.valuationService = new InventoryValuationService(prisma);
    this.statusEngine = new StatusEngine(prisma);
  }

  async execute(input: ApproveOrderInput): Promise<any> {
    const { orderId, organizationId, userId } = input;

    // ── Fase 0: Buscar pedido completo ──────
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        items: {
          include: {
            product: true,
            configurations: {
              include: {
                selectedOption: {
                  include: {
                    material: { select: { id: true, name: true, averageCost: true, currentStock: true } },
                    fichasTecnicas: {
                      include: {
                        material: { select: { id: true, name: true, averageCost: true, currentStock: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        transactions: true
      }
    });

    if (!order) throw new Error('Pedido não encontrado');

    // Bloqueamos apenas pedidos já finalizados/entregues — para esses casos o usuário
    // deve usar o "Regerar Produção" (RegenerateProductionService).
    if (order.status === 'FINISHED' || order.status === 'DELIVERED') {
      throw new Error(`O pedido está no status "${order.status}". Para refazê-lo use a opção "Regerar Produção".`);
    }

    const warnings: string[] = [];
    let stockMovementsCreated = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    // ── Fase 1: Validar Incompatibilidades ──
    const allSelectedOptionIds: string[] = [];
    for (const item of order.items) {
      for (const cfg of item.configurations) {
        if (cfg.selectedOptionId) allSelectedOptionIds.push(cfg.selectedOptionId);
      }
    }
    if (allSelectedOptionIds.length > 0) {
      await this.incompatibilityService.validate(allSelectedOptionIds);
    }

    // ── Fase 1.5: Validar Regras Financeiras da Etapa ──
    await this.statusEngine.validateFinanceRules(orderId, organizationId, 'APPROVED', input.processStatusId);

    // ── Fase 2: Calcular composição e estoque ──
    const stockRequirements = new Map<string, {
      materialId: string;
      materialName: string;
      quantityRequired: number;
      currentStock: number;
      averageCost: number; // Guardará o custo resolvido (seja AVERAGE ou PEPS)
    }>();

    // Determina o método de valoração da empresa (AVERAGE ou PEPS)
    const valuationMethod: ValuationMethod = await this.valuationService.getMethod(organizationId);

    const itemSnapshots: Array<{
      itemId: string;
      unitCostAtSale: number;
      unitPriceAtSale: number;
      profitAtSale: number;
      compositionSnapshot: CompositionLineItem[];
    }> = [];

    for (const item of order.items) {
      const selectedOptionIds = item.configurations
        .map((c: any) => c.selectedOptionId)
        .filter(Boolean);

      const composition = await this.compositionService.calculate({
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
            id: true,
            name: true,
            averageCost: true,
            costPerUnit: true,
            purchasePrice: true,
            format: true,
            purchaseWidth: true,
            purchaseHeight: true,
            currentStock: true,
            trackStock: true,
            categoryId: true
          }
        });

        if (mat) {
          const qty = Number(manual.quantidadeUtilizada || 0) * item.quantity;
          
          // Usa o novo serviço, passando qty pois o PEPS precisa calcular o custo proporcional da quantidade que será consumida
          const unitCost = await this.valuationService.resolveUnitCost(mat, organizationId, valuationMethod, qty);

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
            optionLabel: 'Insumo Adicional'
          });

          if (mat.trackStock) {
            const existing = stockRequirements.get(mat.id);
            if (existing) {
              existing.quantityRequired += qty;
            } else {
              stockRequirements.set(mat.id, {
                materialId: mat.id,
                materialName: mat.name,
                quantityRequired: qty,
                currentStock: Number(mat.currentStock || 0),
                averageCost: unitCost
              });
            }
          }
        }
      }

      const totalItemCost = composition.totalCost + manualCost;
      const unitCostAtSale = totalItemCost / item.quantity;
      const unitPriceAtSale = Number(item.unitPrice);

      itemSnapshots.push({
        itemId: item.id,
        unitCostAtSale,
        unitPriceAtSale,
        profitAtSale: unitPriceAtSale - unitCostAtSale,
        compositionSnapshot: composition.breakdown
      });

      totalRevenue += unitPriceAtSale * item.quantity;
      totalCost += totalItemCost;
    }

    // Validar Estoque
    const stockErrors: string[] = [];
    for (const [, req] of stockRequirements) {
      if (req.currentStock < req.quantityRequired) {
        stockErrors.push(`"${req.materialName}": necessário ${req.quantityRequired.toFixed(4)}, disponível ${req.currentStock.toFixed(4)}`);
      }
    }
    if (stockErrors.length > 0) {
      throw new Error(`Estoque insuficiente:\n${stockErrors.join('\n')}`);
    }

    // Calcular saldo para o Contas a Receber
    const remainingToReceive = OrderFinanceHelper.calculateRemainingBalance(order);

    // ── Fase 3: Transação Atômica ───────────
    await this.prisma.$transaction(async (tx: any) => {
      // 3a. Snapshots e Status nos Itens
      for (const snap of itemSnapshots) {
        await tx.orderItem.update({
          where: { id: snap.itemId },
          data: {
            status: 'APPROVED', // Garante que o item também avance
            unitCostAtSale: snap.unitCostAtSale,
            unitPriceAtSale: snap.unitPriceAtSale,
            profitAtSale: snap.profitAtSale,
            compositionSnapshot: snap.compositionSnapshot as any,
            confirmedAt: new Date()
          }
        });
      }

      // 3b. Baixa de Estoque
      for (const [, req] of stockRequirements) {
        if (req.quantityRequired <= 0) continue;
        
        await tx.material.update({
          where: { id: req.materialId },
          data: { currentStock: { decrement: req.quantityRequired } }
        });

        // Se for PEPS, consome as camadas de entrada para abater do saldo (quantityRemaining)
        if (valuationMethod === 'PEPS') {
          await this.valuationService.debitPepsLayers(tx, req.materialId, organizationId, req.quantityRequired);
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: req.materialId,
            type: 'INTERNAL_CONSUMPTION',
            quantity: req.quantityRequired,
            unitCost: req.averageCost,
            totalCost: req.quantityRequired * req.averageCost,
            notes: `Baixa por Aprovação — Pedido ${order.orderNumber}` + (valuationMethod === 'PEPS' ? ' (Custo Baseado em PEPS)' : '')
          }
        });
        stockMovementsCreated++;
      }

      // 3c. Atualizar Pedido para APPROVED
      // Se não enviaram um processStatusId específico, tentamos achar o primeiro da empresa que seja 'APPROVED'
      let finalProcessStatusId = input.processStatusId;
      if (!finalProcessStatusId) {
        const targetPS = await tx.processStatus.findFirst({
          where: { organizationId, mappedBehavior: 'APPROVED', active: true },
          orderBy: { displayOrder: 'asc' }
        });
        finalProcessStatusId = targetPS?.id;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          processStatusId: finalProcessStatusId,
          approvedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 3d. Histórico
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'APPROVED',
          fromProcessStatusId: order.processStatusId || null,
          toProcessStatusId: finalProcessStatusId || null,
          notes: 'Pedido aprovado para produção — estoque reservado.',
          userId: (userId && userId !== 'system') ? userId : null
        }
      });

      // 3e. Contas a Receber — Sincronização (Ajusta valor ou cancela se pago)
      const existingReceivable = await tx.accountReceivable.findFirst({
        where: { orderId, status: 'PENDING' }
      });

      if (remainingToReceive > 0) {
        if (existingReceivable) {
          const updateNote = ' | Valor ajustado na re-aprovação.';
          const currentNotes = existingReceivable.notes || '';
          
          await tx.accountReceivable.update({
            where: { id: existingReceivable.id },
            data: {
              amount: remainingToReceive,
              notes: currentNotes.includes(updateNote) ? currentNotes : currentNotes + updateNote
            }
          });
        } else {
          // Primeira aprovação: cria o título com o saldo devedor calculado
          await tx.accountReceivable.create({
            data: {
              organizationId,
              customerId: order.customerId,
              orderId,
              amount: remainingToReceive,
              dueDate: order.deliveryDate ? new Date(order.deliveryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: 'PENDING',
              notes: `Título gerado na aprovação do Pedido ${order.orderNumber}`
            }
          });
        }
      } else if (existingReceivable) {
        // Se o saldo agora é zero mas temos um título pendente, cancelamos ele
        await tx.accountReceivable.update({
          where: { id: existingReceivable.id },
          data: {
            status: 'CANCELLED',
            notes: (existingReceivable.notes || '') + ` | Cancelado na aprovação pois o saldo devedor é zero.`
          }
        });
      }

      // 3f. Geração de OPs
      const opGenerator = new OPGeneratorService(tx);
      await opGenerator.generateForOrder(orderId, organizationId);
    });

    // ── Fase 4: Retorno Sincronizado ──────────
    // Buscamos o pedido atualizado com as relações que o frontend precisa para o Dashboard
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

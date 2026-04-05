/**
 * ConfirmOrderService
 *
 * Responsabilidade única: executar a confirmação atômica de um pedido
 * no momento em que o status muda para APPROVED.
 *
 * Fluxo em uma única transação Prisma ($transaction):
 *   1. Valida incompatibilidades entre opções selecionadas
 *   2. Valida estoque suficiente para cada insumo
 *   3. Captura snapshot: unitCostAtSale = Σ(averageCost × qty)
 *   4. Baixa currentStock dos materiais via StockMovement
 *   5. Lança Receita e CMV no Plano de Contas
 *   6. Persiste os campos de snapshot em OrderItem
 */

import { PricingCompositionService, CompositionLineItem } from '../../catalog/services/PricingCompositionService';
import { IncompatibilityService } from '../../catalog/services/IncompatibilityService';
import { OPGeneratorService } from '../../production/services/OPGeneratorService';

export interface ConfirmOrderInput {
  orderId: string;
  organizationId: string;
  userId: string;
  processStatusId?: string;
}

export interface ConfirmOrderResult {
  orderId: string;
  orderNumber: string;
  totalRevenue: number;       // Receita total capturada no snapshot
  totalCost: number;          // CMV total
  totalProfit: number;        // Lucro líquido
  stockMovementsCreated: number;
  warnings: string[];         // Alertas não-bloqueantes (ex: markup abaixo do alvo)
}

export class ConfirmOrderService {
  private compositionService: PricingCompositionService;
  private incompatibilityService: IncompatibilityService;

  constructor(private readonly prisma: any) {
    this.compositionService = new PricingCompositionService(prisma);
    this.incompatibilityService = new IncompatibilityService(prisma);
  }

  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderResult> {
    const { orderId, organizationId, userId } = input;

    // ── Fase 0: Buscar pedido completo ─────────────────────────────────────
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
        }
      }
    });

    if (!order) throw new Error('Pedido não encontrado');

    if (order.status === 'APPROVED' || order.status === 'DELIVERED') {
      throw new Error('Este pedido já foi confirmado anteriormente');
    }

    const warnings: string[] = [];
    let stockMovementsCreated = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    // ── Fase 1: Coleta e validação ──────────────────────────────────────────
    // Agregar todos os selectedOptionIds do pedido para validação de incompatibilidade
    const allSelectedOptionIds: string[] = [];
    for (const item of order.items) {
      for (const cfg of item.configurations) {
        if (cfg.selectedOptionId) allSelectedOptionIds.push(cfg.selectedOptionId);
      }
    }

    if (allSelectedOptionIds.length > 0) {
      await this.incompatibilityService.validate(allSelectedOptionIds);
    }

    // ── Fase 2: Calcular composição e validar estoque ───────────────────────
    // Mapa materialId → quantidade total necessária (todos os itens do pedido)
    const stockRequirements = new Map<string, {
      materialId: string;
      materialName: string;
      quantityRequired: number;
      currentStock: number;
      averageCost: number;
    }>();

    // Estrutura para snapshot de cada item
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

      // Calcula custo real da composição deste item
      const composition = await this.compositionService.calculate({
        productId: item.productId,
        selectedOptionIds,
        quantity: item.quantity,
        organizationId
      });

      // ── Processar Insumos Adicionais (Manuais) ────────────────────────────
      const attributes = (item as any).attributes || {};
      const manualInsumos = Array.isArray(attributes.insumos) ? attributes.insumos : [];
      
      let manualCost = 0;
      for (const manual of manualInsumos) {
        const matId = manual.insumoId;
        const matQty = Number(manual.quantidadeUtilizada || 0) * item.quantity;
        
        // Buscar dados reais do material para garantir averageCost atualizado
        const mat = await this.prisma.material.findUnique({
          where: { id: matId },
          select: { id: true, name: true, averageCost: true, currentStock: true, trackStock: true }
        });

        if (mat) {
          manualCost += matQty * Number(mat.averageCost || 0);

          // Adicionar ao breakdown para o snapshot
          composition.breakdown.push({
            materialId: mat.id,
            materialName: mat.name,
            quantity: matQty,
            costPerUnit: Number(mat.averageCost || 0),
            subtotal: matQty * Number(mat.averageCost || 0),
            source: 'FICHA_TECNICA', // Tratado como ficha técnica manual
            optionLabel: 'Insumo Adicional'
          });

          // Adicionar aos requisitos de estoque
          if (mat.trackStock) {
            const existing = stockRequirements.get(mat.id);
            if (existing) {
              existing.quantityRequired += matQty;
            } else {
              stockRequirements.set(mat.id, {
                materialId: mat.id,
                materialName: mat.name,
                quantityRequired: matQty,
                currentStock: Number(mat.currentStock || 0),
                averageCost: Number(mat.averageCost || 0)
              });
            }
          }
        }
      }

      const totalItemCost = composition.totalCost + manualCost;
      const unitCostAtSale = totalItemCost / item.quantity;
      const unitPriceAtSale = Number(item.unitPrice);
      const profitAtSale = unitPriceAtSale - unitCostAtSale;

      // Alerta se margem negativa
      if (profitAtSale * item.quantity < -0.01) { // Tolerância de centavos
        warnings.push(`Item "${item.product.name}": preço de venda (${unitPriceAtSale.toFixed(2)}) menor que o custo (${unitCostAtSale.toFixed(2)})`);
      }

      itemSnapshots.push({
        itemId: item.id,
        unitCostAtSale,
        unitPriceAtSale,
        profitAtSale,
        compositionSnapshot: composition.breakdown
      });

      totalRevenue += unitPriceAtSale * item.quantity;
      totalCost += totalItemCost;
    }


    // ── Fase 2b: Validar estoque agregado ──────────────────────────────────
    const stockErrors: string[] = [];
    for (const [, req] of stockRequirements) {
      if (req.currentStock < req.quantityRequired) {
        const deficit = req.quantityRequired - req.currentStock;
        stockErrors.push(
          `"${req.materialName}": necessário ${req.quantityRequired.toFixed(4)}, disponível ${req.currentStock.toFixed(4)} (déficit: ${deficit.toFixed(4)})`
        );
      }
    }

    if (stockErrors.length > 0) {
      throw new Error(`Estoque insuficiente para confirmar o pedido:\n${stockErrors.join('\n')}`);
    }

    totalProfit = totalRevenue - totalCost;

    // ── Fase 3: Transação Atômica ──────────────────────────────────────────
    await this.prisma.$transaction(async (tx: any) => {

      // 3a. Persistir snapshots em cada OrderItem
      for (const snap of itemSnapshots) {
        await tx.orderItem.update({
          where: { id: snap.itemId },
          data: {
            unitCostAtSale: snap.unitCostAtSale,
            unitPriceAtSale: snap.unitPriceAtSale,
            profitAtSale: snap.profitAtSale,
            compositionSnapshot: snap.compositionSnapshot as any,
            confirmedAt: new Date()
          }
        });
      }

      // 3b. Baixar estoque real dos materiais
      for (const [materialId, req] of stockRequirements) {
        if (req.quantityRequired <= 0) continue;

        // Decrementa currentStock
        await tx.material.update({
          where: { id: materialId },
          data: {
            currentStock: { decrement: req.quantityRequired }
          }
        });

        // Registra StockMovement para rastreabilidade
        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId,
            type: 'INTERNAL_CONSUMPTION',
            quantity: req.quantityRequired,
            unitCost: req.averageCost,
            totalCost: req.quantityRequired * req.averageCost,
            notes: `Baixa automática — Pedido ${order.orderNumber} confirmado`,
          }
        });

        stockMovementsCreated++;
      }

      // 3c. Lançamentos no Plano de Contas
      const defaultAccount = await tx.account.findFirst({
        where: { organizationId, active: true }
      });

      if (defaultAccount) {
        // Receita de venda (INCOME)
        await tx.transaction.create({
          data: {
            organizationId,
            accountId: defaultAccount.id,
            type: 'INCOME',
            amount: totalRevenue,
            description: `Receita de Venda — Pedido ${order.orderNumber}`,
            orderId,
            status: 'PAID',
            paidAt: new Date(),
            userId,
            profileId: order.customerId
          }
        });

        // CMV — Custo da Mercadoria Vendida (EXPENSE)
        if (totalCost > 0) {
          await tx.transaction.create({
            data: {
              organizationId,
              accountId: defaultAccount.id,
              type: 'EXPENSE',
              amount: totalCost,
              description: `CMV — Pedido ${order.orderNumber} (custo de insumos)`,
              orderId,
              status: 'PAID',
              paidAt: new Date(),
              userId
            }
          });
        }
      }

      // 3d. Marcar o pedido como APPROVED (ou etapa específica)
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          processStatusId: input.processStatusId || null
        }
      });

      // 3e. Registrar histórico de status
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'APPROVED',
          notes: 'Pedido confirmado — snapshot de custo e estoque registrado',
          userId
        }
      });

      // ── Fase 4: Automação de Produção (Geração de OPs) ──
      // Usamos o OPGeneratorService para criar as ordens de produção baseadas no snapshot.
      const opGenerator = new OPGeneratorService(tx);
      await opGenerator.generateForOrder(orderId, organizationId);
    });

    return {
      orderId,
      orderNumber: order.orderNumber,
      totalRevenue,
      totalCost,
      totalProfit,
      stockMovementsCreated,
      warnings
    };
  }
}

// Variável auxiliar fora do try para permitir referência no return
let totalProfit = 0;

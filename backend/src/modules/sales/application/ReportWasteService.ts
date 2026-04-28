import { InventoryValuationService } from '../../../shared/services/InventoryValuationService';

export class ReportWasteService {
  constructor(
    private readonly prisma: any,
    private readonly valuationService: InventoryValuationService
  ) {}

  async execute(params: {
    orderId: string;
    itemId: string;
    materialId: string;
    wasteQuantity: number;
    reason: string;
    organizationId: string;
    userId: string;
    overrideUnitCost?: number;
  }) {
    const { orderId, itemId, materialId, wasteQuantity, reason, organizationId, userId, overrideUnitCost } = params;

    if (wasteQuantity <= 0) throw new Error('A quantidade de perda deve ser maior que zero');

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, order: { organizationId } },
      include: { order: true }
    });
    if (!orderItem) throw new Error('Item não encontrado ou não pertence a esta organização');

    const material = await this.prisma.material.findUnique({
      where: { id: materialId, organizationId },
      include: { category: true }
    });
    if (!material) throw new Error('Insumo não encontrado');

    const method = await this.valuationService.getMethod(organizationId);

    // 1. Transaction Atômica
    return await this.prisma.$transaction(async (tx: any) => {
        // Custo atual do insumo pela valoração (ou override manual)
        const unitCost = overrideUnitCost !== undefined 
            ? overrideUnitCost 
            : await this.valuationService.resolveUnitCost(material, organizationId, method, wasteQuantity);
            
        const wasteTotalCost = unitCost * wasteQuantity;

        // A. Cria o registro de perda analítico (Reporting)
        const wasteRecord = await tx.productionWaste.create({
            data: {
                orderId,
                productId: orderItem.productId,
                materialId,
                plannedQuantity: 0, // Não temos planejado isolado aqui
                actualQuantity: wasteQuantity,
                wasteQuantity: wasteQuantity,
                wasteReason: reason,
                reportedBy: userId,
            }
        });

        // B. Baixa de Estoque
        if (material.trackStock) {
            const currentStock = Number(material.currentStock || 0);
            if (currentStock < wasteQuantity) {
                throw new Error(`Estoque insuficiente de ${material.name}. Disponível: ${currentStock}, Precisa: ${wasteQuantity}. O registro de perda bloquearia o estoque negativo.`);
            }

            await tx.material.update({
                where: { id: materialId },
                data: { currentStock: { decrement: wasteQuantity } }
            });

            if (method === 'PEPS') {
                await this.valuationService.consumeFifo(materialId, wasteQuantity, organizationId);
            }

            await tx.stockMovement.create({
                data: {
                    organizationId,
                    materialId,
                    type: 'INTERNAL_CONSUMPTION',
                    quantity: wasteQuantity,
                    unitCost: unitCost,
                    totalCost: wasteTotalCost,
                    notes: `Perda - Pedido ${orderItem.order.orderNumber}. Motivo: ${reason}`,
                    userId
                }
            });
        }

        // C. Adiciona o custo direto ao OrderItem para corroer o Lucro e aparecer no DRE
        const currentUnitCostAtSale = Number(orderItem.unitCostAtSale || 0);
        
        // CUIDADO FINANCEIRO: O unitCostAtSale representa o CMV de "1 unidade comprada". 
        // Se a quantidade vendida na OS for 3, o DRE vai fazer (unitCostAtSale * 3).
        // Se a gente perdeu R$ 30, o unitCostAtSale tem que subir exatos (30 / 3) = 10, assim o total cresce 30.
        const additionalUnitCost = wasteTotalCost / Math.max(1, orderItem.quantity);
        const newUnitCostAtSale = currentUnitCostAtSale + additionalUnitCost;
        
        const newProfitAtSale = Number(orderItem.unitPriceAtSale || orderItem.unitPrice || 0) - newUnitCostAtSale;

        // Anexar no Snapshot para histórico visível na DRE / UI de conferência
        let snapshot: any[] = [];
        try {
            if (Array.isArray(orderItem.compositionSnapshot)) {
                snapshot = orderItem.compositionSnapshot;
            } else if (orderItem.compositionSnapshot) {
                snapshot = JSON.parse(orderItem.compositionSnapshot);
            }
        } catch { snapshot = []; }

        snapshot.push({
            materialId,
            materialName: material.name,
            materialCategory: material.category?.name,
            materialCategoryId: material.categoryId,
            quantity: wasteQuantity,
            costPerUnit: unitCost,
            subtotal: wasteTotalCost,
            source: 'REWORK_WASTE',
            optionLabel: `PERDA: ${reason}`
        });

        await tx.orderItem.update({
            where: { id: itemId },
            data: {
                unitCostAtSale: newUnitCostAtSale,
                profitAtSale: newProfitAtSale,
                compositionSnapshot: snapshot
            }
        });

        return wasteRecord;
    });
  }
}

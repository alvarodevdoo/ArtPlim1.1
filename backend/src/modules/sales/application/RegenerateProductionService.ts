/**
 * RegenerateProductionService
 *
 * Responsabilidade: Regerar a produção de um pedido que foi entregue com defeito
 * ou precisa ser refeito por qualquer razão operacional.
 *
 * FLUXO:
 * 1. Mantém o pedido como FINISHED (a venda já aconteceu, o DRE não muda).
 * 2. Volta o status para APPROVED (pronto para produção novamente).
 * 3. Cancela as OPs antigas e gera novas OPs do zero para todos os itens.
 * 4. Baixa o estoque novamente (custo de retrabalho).
 * 5. Registra no histórico com a justificativa.
 *
 * IMPORTANTE: Não altera o Contas a Receber nem o finishedAt (DRE intacto).
 */

import { OPGeneratorService } from '../../production/services/OPGeneratorService';

export interface RegenerateProductionInput {
  orderId: string;
  organizationId: string;
  userId: string;
  reason: string; // Obrigatório — ex: "Defeito de impressão", "Erro de tamanho"
  itemIds?: string[]; // Opcional: refazer apenas itens específicos. Se vazio, refaz todos.
}

export class RegenerateProductionService {
  constructor(private readonly prisma: any) {}

  async execute(input: RegenerateProductionInput): Promise<any> {
    const { orderId, organizationId, userId, reason, itemIds } = input;

    if (!reason || reason.trim().length < 3) {
      throw new Error('É obrigatório informar o motivo da regeneração de produção.');
    }

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
                    material: { select: { id: true, name: true, averageCost: true, currentStock: true, trackStock: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) throw new Error('Pedido não encontrado.');

    // Determinar quais itens vão ser regenerados
    const targetItems = itemIds && itemIds.length > 0
      ? order.items.filter((i: any) => itemIds.includes(i.id))
      : order.items;

    if (targetItems.length === 0) {
      throw new Error('Nenhum item encontrado para regenerar.');
    }

    // Coletar novos requisitos de estoque baseado nos snapshots existentes
    const stockRequirements = new Map<string, {
      materialId: string;
      materialName: string;
      quantityRequired: number;
      currentStock: number;
      averageCost: number;
    }>();

    for (const item of targetItems) {
      const snapshot = (item as any).compositionSnapshot as any[];
      if (Array.isArray(snapshot)) {
        for (const line of snapshot) {
          if (!line.materialId) continue;
          const mat = await this.prisma.material.findUnique({
            where: { id: line.materialId },
            select: { id: true, name: true, averageCost: true, currentStock: true, trackStock: true }
          });
          if (mat && mat.trackStock) {
            const existing = stockRequirements.get(mat.id);
            if (existing) {
              existing.quantityRequired += Number(line.quantity || 0);
            } else {
              stockRequirements.set(mat.id, {
                materialId: mat.id,
                materialName: mat.name,
                quantityRequired: Number(line.quantity || 0),
                currentStock: Number(mat.currentStock || 0),
                averageCost: Number(mat.averageCost || 0)
              });
            }
          }
        }
      }
    }

    // Validar estoque disponível
    const stockErrors: string[] = [];
    for (const [, req] of stockRequirements) {
      if (req.currentStock < req.quantityRequired) {
        stockErrors.push(`"${req.materialName}": necessário ${req.quantityRequired.toFixed(4)}, disponível ${req.currentStock.toFixed(4)}`);
      }
    }
    if (stockErrors.length > 0) {
      throw new Error(`Estoque insuficiente para refazer:\n${stockErrors.join('\n')}`);
    }

    // Executar tudo em transação atômica
    await this.prisma.$transaction(async (tx: any) => {
      const targetItemIds = targetItems.map((i: any) => i.id);

      // 1. Cancelar OPs antigas dos itens a serem refeitos
      await tx.productionOrder.updateMany({
        where: { orderItemId: { in: targetItemIds } },
        data: { status: 'CANCELLED' }
      });

      // 2. Baixar estoque novamente (custo de retrabalho)
      for (const [, req] of stockRequirements) {
        if (req.quantityRequired <= 0) continue;
        await tx.material.update({
          where: { id: req.materialId },
          data: { currentStock: { decrement: req.quantityRequired } }
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: req.materialId,
            type: 'INTERNAL_CONSUMPTION',
            quantity: req.quantityRequired,
            unitCost: req.averageCost,
            totalCost: req.quantityRequired * req.averageCost,
            notes: `[RETRABALHO] Pedido ${order.orderNumber} — ${reason}`
          }
        });
      }

      // 3. Voltar o status para APPROVED (produção pode recomeçar)
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          finishedAt: null, // Remove a data de finalização — o pedido voltou para produção
          updatedAt: new Date()
        }
      });

      // 4. Registrar no histórico
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status as any,
          toStatus: 'APPROVED',
          notes: `[RETRABALHO] ${reason}`,
          userId
        }
      });
    });

    // 5. Gerar novas OPs (fora da transação para não travar)
    const opGenerator = new OPGeneratorService(this.prisma);
    for (const item of targetItems) {
      // Forçamos a geração deletando o registro único para que generateForOrderItem crie um novo
      await this.prisma.productionOrder.deleteMany({
        where: { orderItemId: item.id, status: 'CANCELLED' }
      });
      await opGenerator.generateForOrderItem(item.id, organizationId);
    }

    // Retornar pedido completo para sincronizar o frontend
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

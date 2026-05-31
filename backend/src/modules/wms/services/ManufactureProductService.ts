import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';
import { PricingEngine } from '../../../shared/application/pricing/PricingEngine';

interface MachineMinuteInput {
  machineId: string;
  minutes: number;
}

export interface ManufactureProductInput {
  productId: string;
  quantity: number;
  /**
   * Variáveis dinâmicas no formato esperado pelo PricingEngine:
   * { GRAMAS_AZUL: { value: 80, unit: 'g' }, ... }
   * Se omitido, o motor usa apenas BOM estática.
   */
  variables?: Record<string, { value?: any; unit: string | null }>;
  selectedOptionIds?: string[];
  /**
   * Largura/Altura em mm — opcional, repassa pro PricingEngine
   * para dimensionar consumo de materiais por área.
   */
  width?: number;
  height?: number;
  /**
   * Tempo registrado em cada máquina (não debita custo no DRE,
   * só fica armazenado na ProductionOrder para histórico/análise).
   */
  machineMinutes?: MachineMinuteInput[];
  notes?: string;
}

/**
 * ManufactureProductService
 * ------------------------------------------------------------------
 * Implementa o fluxo "Produção Interna":
 *   1. Calcula a BOM via PricingEngine (reusa motor do pedido).
 *   2. Debita cada insumo via FIFO sem lançar despesa no DRE
 *      (transferência interna de valor — não é fato gerador contábil).
 *   3. Credita Product.stockQuantity ao custo total calculado
 *      e atualiza Product.averageCost via custo médio ponderado.
 *   4. Cria ProductionOrder type=INTERNAL_MANUFACTURING com snapshot
 *      das variáveis e tempos de máquina (para "repetir produção").
 *
 * Importante: NÃO cria Transaction no financeiro. O custo só vira
 * despesa (COGS) quando o produto acabado for vendido via Pedido.
 */
export class ManufactureProductService {
  constructor(private prisma: PrismaClient) {}

  async execute(organizationId: string, userId: string, input: ManufactureProductInput) {
    if (input.quantity <= 0) {
      throw new AppError('Quantidade a produzir deve ser maior que zero.', 400);
    }

    // 1. Calcular BOM via PricingEngine (reusa todo o motor do pedido)
    const engine = new PricingEngine();
    const calc = await engine.execute({
      productId: input.productId,
      quantity: input.quantity,
      width: input.width,
      height: input.height,
      variables: (input.variables ?? {}) as any,
      selectedOptionIds: input.selectedOptionIds ?? [],
      organizationId,
    });

    if (!calc.insumos || calc.insumos.length === 0) {
      throw new AppError(
        'Produto sem ficha técnica (BOM) configurada. Cadastre os insumos antes de produzir internamente.',
        400
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new AppError('Produto não encontrado.', 404);
      if (product.organizationId !== organizationId) throw new AppError('Acesso não autorizado.', 403);

      // 2. Criar a ProductionOrder primeiro (para vincular os movimentos)
      const productionOrder = await tx.productionOrder.create({
        data: {
          organizationId,
          type: 'INTERNAL_MANUFACTURING',
          productId: input.productId,
          quantity: new Prisma.Decimal(input.quantity),
          variables: (input.variables as any) ?? Prisma.JsonNull,
          machineMinutes: (input.machineMinutes as any) ?? Prisma.JsonNull,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          notes: input.notes,
        }
      });

      let totalCostOfRun = 0;

      // 3. Debitar cada insumo (FIFO, sem lançar no DRE)
      for (const insumo of calc.insumos) {
        // Quantidade total = quantidade por unidade × quantidade produzida
        const totalQty = Number(insumo.quantidade) * input.quantity;
        if (totalQty <= 0) continue;

        const material = await tx.material.findUnique({ where: { id: insumo.id } });
        if (!material) throw new AppError(`Material ${insumo.nome} não encontrado.`, 404);

        const currentStock = Number(material.currentStock ?? 0);
        if (currentStock < totalQty && !material.sellWithoutStock) {
          throw new AppError(
            `Estoque insuficiente de "${material.name}". Disponível: ${currentStock} ${material.unit}. Necessário: ${totalQty} ${material.unit}.`,
            400
          );
        }

        // FIFO: consome dos lotes mais antigos
        const activeBatches = await tx.stockMovement.findMany({
          where: {
            materialId: material.id,
            organizationId,
            type: 'ENTRY',
            isCancelled: false,
            quantityRemaining: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        });

        let remainingToConsume = totalQty;
        let totalValueCalculated = 0;
        const consumedFromBatches: string[] = [];

        for (const batch of activeBatches) {
          if (remainingToConsume <= 0) break;
          const batchQty = Number(batch.quantityRemaining);
          const take = Math.min(batchQty, remainingToConsume);

          await tx.stockMovement.update({
            where: { id: batch.id },
            data: { quantityRemaining: new Prisma.Decimal(batchQty - take) }
          });

          totalValueCalculated += take * Number(batch.unitCost);
          consumedFromBatches.push(batch.id);
          remainingToConsume -= take;
        }

        // Fallback ao custo médio se sobrar (estoque negativo permitido)
        if (remainingToConsume > 0) {
          const fallback = Number(material.averageCost || 0);
          totalValueCalculated += remainingToConsume * fallback;
        }

        const calculatedUnitCost = totalQty > 0 ? totalValueCalculated / totalQty : 0;
        const newStock = currentStock - totalQty;

        await tx.material.update({
          where: { id: material.id },
          data: { currentStock: new Prisma.Decimal(newStock) }
        });

        // StockMovement PRODUCTION_CONSUMPTION (sem lançamento contábil!)
        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: material.id,
            productionOrderId: productionOrder.id,
            userId,
            type: 'PRODUCTION_CONSUMPTION',
            quantity: new Prisma.Decimal(totalQty),
            unitCost: new Prisma.Decimal(calculatedUnitCost),
            totalCost: new Prisma.Decimal(totalValueCalculated),
            oldQuantity: new Prisma.Decimal(currentStock),
            oldUnitCost: new Prisma.Decimal(material.averageCost || 0),
            notes: `Produção interna #${productionOrder.id.slice(0, 8)} — ${product.name}` +
                   (consumedFromBatches.length > 0 ? ` [FIFO: ${consumedFromBatches.length} lote(s)]` : ''),
          }
        });

        totalCostOfRun += totalValueCalculated;
      }

      // 4. Creditar Product.stockQuantity + atualizar averageCost
      const currentProductStock = Number(product.stockQuantity ?? 0);
      const currentProductAvg = Number(product.averageCost ?? 0);
      const newProductStock = currentProductStock + input.quantity;
      const unitCostThisRun = totalCostOfRun / input.quantity;

      // Custo médio ponderado do produto acabado
      const newAvgCost = newProductStock > 0
        ? ((currentProductStock * currentProductAvg) + totalCostOfRun) / newProductStock
        : 0;

      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: newProductStock,
          averageCost: new Prisma.Decimal(newAvgCost),
          trackStock: true, // Garante rastreio após primeira produção
        }
      });

      // StockMovement PRODUCTION_OUTPUT (entrada de produto acabado)
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: product.id,
          productionOrderId: productionOrder.id,
          userId,
          type: 'PRODUCTION_OUTPUT',
          quantity: new Prisma.Decimal(input.quantity),
          unitCost: new Prisma.Decimal(unitCostThisRun),
          totalCost: new Prisma.Decimal(totalCostOfRun),
          oldQuantity: new Prisma.Decimal(currentProductStock),
          oldUnitCost: new Prisma.Decimal(currentProductAvg),
          quantityRemaining: new Prisma.Decimal(input.quantity),
          notes: `Produção interna concluída — ${product.name} × ${input.quantity}`,
        }
      });

      // 5. Finalizar a ProductionOrder com totalizadores
      const finalOrder = await tx.productionOrder.update({
        where: { id: productionOrder.id },
        data: {
          status: 'FINISHED',
          finishedAt: new Date(),
          totalCost: new Prisma.Decimal(totalCostOfRun),
          unitCost: new Prisma.Decimal(unitCostThisRun),
        }
      });

      return {
        productionOrder: finalOrder,
        totalCost: totalCostOfRun,
        unitCost: unitCostThisRun,
        newProductStock,
        insumosConsumed: calc.insumos.map(i => ({
          materialId: i.id,
          nome: i.nome,
          quantidadePorUnidade: i.quantidade,
          quantidadeTotal: Number(i.quantidade) * input.quantity,
          unidade: i.unidade,
        })),
        calculationLog: calc.details,
      };
    });
  }

  /**
   * Lista as últimas produções internas — usado pra "repetir" rapidamente
   * uma produção anterior (mesmo produto, mesmas variáveis).
   */
  async listRecent(organizationId: string, limit = 20) {
    return this.prisma.productionOrder.findMany({
      where: {
        organizationId,
        type: 'INTERNAL_MANUFACTURING',
      },
      include: {
        product: { select: { id: true, name: true, stockUnit: true, stockQuantity: true } }
      },
      orderBy: { finishedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Re-executa uma produção interna a partir de uma anterior (preset).
   * Reaplica produto + variáveis + machineMinutes, mas usa a quantidade fornecida.
   */
  async repeatFromPreset(
    organizationId: string,
    userId: string,
    presetId: string,
    quantity: number
  ) {
    const preset = await this.prisma.productionOrder.findUnique({
      where: { id: presetId }
    });
    if (!preset || preset.organizationId !== organizationId) {
      throw new AppError('Produção de referência não encontrada.', 404);
    }
    if (preset.type !== 'INTERNAL_MANUFACTURING' || !preset.productId) {
      throw new AppError('Referência inválida — só produções internas podem ser repetidas.', 400);
    }

    return this.execute(organizationId, userId, {
      productId: preset.productId,
      quantity,
      variables: (preset.variables as any) ?? undefined,
      machineMinutes: (preset.machineMinutes as any) ?? undefined,
      notes: `Repetida de #${preset.id.slice(0, 8)}`,
    });
  }
}

import { resolveDisplayUnit } from '../../../shared/utils/unitOfMeasure';

/**
 * StockReservationService
 *
 * Gerencia reservas de estoque (soft) para Produtos e Materiais.
 *
 * Reserva = "estoque comprometido em pedidos ativos (não cancelados, não aprovados)".
 * - Criada na criação/edição do pedido (DRAFT)
 * - Liberada ao APROVAR (estoque físico debitado) ou CANCELAR
 *
 * Disponível = stock atual - soma de reservas de OUTROS pedidos
 */
export class StockReservationService {
  constructor(private readonly prisma: any) {}

  /**
   * Cria (ou recria) reservas de produtos E materiais para um pedido.
   */
  /**
   * Cria (ou recria) reservas de produtos E materiais para um pedido.
   * @param skipValidation Se true, não valida disponibilidade (usar quando estoque já foi baixado/ajustado antes)
   */
  async reserveForOrder(
    orderId: string,
    organizationId: string,
    productItems: Array<{ productId: string; quantity: number }>,
    materialUsage: Map<string, number> | Array<{ materialId: string; quantity: number }> = new Map(),
    tx?: any,
    skipValidation: boolean = false
  ): Promise<void> {
    const client = tx || this.prisma;

    const materialMap = materialUsage instanceof Map
      ? materialUsage
      : new Map(materialUsage.map(m => [m.materialId, m.quantity]));

    // Apaga TODAS as reservas anteriores deste pedido (recalcula do zero)
    await client.stockReservation.deleteMany({ where: { orderId } });

    // ── Reservas de PRODUTOS ─────────────────────────────────────────
    const productIds = productItems.map(i => i.productId);
    if (productIds.length > 0) {
      const products = await client.product.findMany({
        where: { id: { in: productIds }, stockQuantity: { not: null } },
        select: { id: true, name: true, stockQuantity: true, sellWithoutStock: true }
      });
      const prodMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      for (const item of productItems) {
        const product = prodMap.get(item.productId);
        if (!product) continue;

        if (!skipValidation) {
          const agg = await client.stockReservation.aggregate({
            where: { productId: item.productId, organizationId, orderId: { not: orderId } },
            _sum: { quantity: true }
          });
          const reservedByOthers = Number(agg._sum.quantity ?? 0);
          const available = Number(product.stockQuantity ?? 0) - reservedByOthers;

          if (available < item.quantity) {
            throw new Error(
              `Estoque insuficiente para o produto "${product.name}": ` +
              `disponível ${available}, solicitado ${item.quantity}.`
            );
          }
        }

        await client.stockReservation.create({
          data: { organizationId, orderId, productId: item.productId, quantity: item.quantity }
        });
      }
    }

    // ── Reservas de MATERIAIS (insumos) ──────────────────────────────
    if (materialMap.size > 0) {
      const materialIds = Array.from(materialMap.keys());
      const materials = await client.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true, name: true, currentStock: true, sellWithoutStock: true, trackStock: true, unit: true, controlUnit: true }
      });

      for (const mat of materials) {
        const needed = materialMap.get(mat.id) || 0;
        if (needed <= 0) continue;

        if (mat.trackStock && !skipValidation) {
          const agg = await client.stockReservation.aggregate({
            where: { materialId: mat.id, organizationId, orderId: { not: orderId } },
            _sum: { quantity: true }
          });
          const reservedByOthers = Number(agg._sum.quantity ?? 0);
          const available = Number(mat.currentStock ?? 0) - reservedByOthers;

          if (available < needed) {
            const unitLabel = resolveDisplayUnit(mat);
            throw new Error(
              `Estoque insuficiente para o insumo "${mat.name}": ` +
              `disponível ${available.toFixed(2)} ${unitLabel}, ` +
              `solicitado ${needed.toFixed(2)} ${unitLabel}.`
            );
          }
        }

        await client.stockReservation.create({
          data: { organizationId, orderId, materialId: mat.id, quantity: needed }
        });
      }
    }
  }

  /**
   * Verifica disponibilidade SEM persistir reservas.
   * Retorna lista de rupturas; vazio = OK.
   */
  async checkAvailability(
    organizationId: string,
    productItems: Array<{ productId: string; quantity: number }>,
    materialUsage: Map<string, number> | Array<{ materialId: string; quantity: number }>,
    excludeOrderId?: string
  ): Promise<{
    breakdown: Array<{ kind: 'product' | 'material'; id: string; name: string; available: number; needed: number; unit?: string; ok: boolean }>;
    ruptures: Array<{ kind: 'product' | 'material'; id: string; name: string; available: number; needed: number; unit?: string }>;
  }> {
    const breakdown: Array<{ kind: 'product' | 'material'; id: string; name: string; available: number; needed: number; unit?: string; ok: boolean }> = [];
    const ruptures: Array<{ kind: 'product' | 'material'; id: string; name: string; available: number; needed: number; unit?: string }> = [];

    const materialMap = materialUsage instanceof Map
      ? materialUsage
      : new Map(materialUsage.map(m => [m.materialId, m.quantity]));

    // Produtos
    const productIds = productItems.map(i => i.productId);
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, stockQuantity: { not: null } },
        select: { id: true, name: true, stockQuantity: true, stockUnit: true }
      });

      for (const p of products) {
        const item = productItems.find(i => i.productId === p.id);
        if (!item) continue;

        const where: any = { productId: p.id, organizationId };
        if (excludeOrderId) where.orderId = { not: excludeOrderId };
        const agg = await this.prisma.stockReservation.aggregate({ where, _sum: { quantity: true } });
        const reserved = Number(agg._sum.quantity ?? 0);
        const available = Number(p.stockQuantity ?? 0) - reserved;

        const entry = { kind: 'product' as const, id: p.id, name: p.name, available, needed: item.quantity, unit: resolveDisplayUnit(p) };
        breakdown.push({ ...entry, ok: available >= item.quantity });
        if (available < item.quantity) ruptures.push(entry);
      }
    }

    // Materiais
    if (materialMap.size > 0) {
      const materialIds = Array.from(materialMap.keys());
      const materials = await this.prisma.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true, name: true, currentStock: true, unit: true, controlUnit: true, trackStock: true }
      });

      for (const m of materials) {
        if (!m.trackStock) continue;
        const needed = materialMap.get(m.id) || 0;
        if (needed <= 0) continue;

        const where: any = { materialId: m.id, organizationId };
        if (excludeOrderId) where.orderId = { not: excludeOrderId };
        const agg = await this.prisma.stockReservation.aggregate({ where, _sum: { quantity: true } });
        const reserved = Number(agg._sum.quantity ?? 0);
        const available = Number(m.currentStock ?? 0) - reserved;

        const entry = { kind: 'material' as const, id: m.id, name: m.name, available, needed, unit: resolveDisplayUnit(m) };
        breakdown.push({ ...entry, ok: available >= needed });
        if (available < needed) ruptures.push(entry);
      }
    }

    return { breakdown, ruptures };
  }

  /** Libera TODAS as reservas (produtos + materiais) de um pedido. */
  async releaseForOrder(orderId: string, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.stockReservation.deleteMany({ where: { orderId } });
  }

  // ── Consulta de disponibilidade ─────────────────────────────────────

  async getAvailableStock(productId: string, organizationId: string, excludeOrderId?: string): Promise<number | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true }
    });
    if (product?.stockQuantity == null) return null;

    const where: any = { productId, organizationId };
    if (excludeOrderId) where.orderId = { not: excludeOrderId };

    const agg = await this.prisma.stockReservation.aggregate({ where, _sum: { quantity: true } });
    return Number(product.stockQuantity) - Number(agg._sum.quantity ?? 0);
  }

  async getAvailableStockBatch(productIds: string[], organizationId: string): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>();
    if (productIds.length === 0) return result;

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stockQuantity: true }
    });

    const trackedIds = products.filter((p: any) => p.stockQuantity != null).map((p: any) => p.id);
    if (trackedIds.length === 0) {
      for (const p of products) result.set(p.id, null);
      return result;
    }

    const reservations = await this.prisma.stockReservation.groupBy({
      by: ['productId'],
      where: { productId: { in: trackedIds }, organizationId },
      _sum: { quantity: true }
    });
    const reservedMap = new Map<string, number>(
      reservations.map((r: any) => [r.productId, Number(r._sum.quantity ?? 0)])
    );

    for (const p of products) {
      if (p.stockQuantity == null) result.set(p.id, null);
      else result.set(p.id, Number(p.stockQuantity) - (reservedMap.get(p.id) ?? 0));
    }
    return result;
  }

  /** Disponível para um material = currentStock - reservas (excluindo o pedido atual, se passado) */
  async getAvailableMaterialStock(materialId: string, organizationId: string, excludeOrderId?: string): Promise<number | null> {
    const mat = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { currentStock: true, trackStock: true }
    });
    if (!mat?.trackStock) return null;

    const where: any = { materialId, organizationId };
    if (excludeOrderId) where.orderId = { not: excludeOrderId };

    const agg = await this.prisma.stockReservation.aggregate({ where, _sum: { quantity: true } });
    return Number(mat.currentStock ?? 0) - Number(agg._sum.quantity ?? 0);
  }
}

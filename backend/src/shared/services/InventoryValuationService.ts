/**
 * InventoryValuationService
 *
 * Responsabilidade única: resolver o custo unitário de um material
 * respeitando o método de valoração configurado na organização:
 *
 *   - AVERAGE: custo médio ponderado (campo averageCost atualizado em cada entrada)
 *   - PEPS:    First In, First Out — consume os lotes mais antigos primeiro,
 *              calculando o custo ponderado dos lotes consumidos via quantityRemaining
 *
 * Hierarquia de fallback para o custo unitário (ambos os métodos):
 *   averageCost/custo-lote → costPerUnit → purchasePrice derivado por área → purchasePrice direto → 0
 *
 * Uso:
 *   const svc = new InventoryValuationService(prisma);
 *   const method = await svc.getMethod(organizationId);
 *   const cost   = await svc.resolveUnitCost(material, organizationId, method);
 */

export type ValuationMethod = 'AVERAGE' | 'PEPS';

export interface MaterialCostable {
  id: string;
  averageCost?: number | null;
  costPerUnit?: number | null;
  purchasePrice?: number | null;
  purchaseWidth?: number | null;
  purchaseHeight?: number | null;
  format?: string | null;
}

export class InventoryValuationService {
  constructor(private readonly prisma: any) {}

  /**
   * Obtém o método configurado para a organização.
   * Padrão: AVERAGE (caso settings não exista).
   */
  async getMethod(organizationId: string): Promise<ValuationMethod> {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { inventoryValuationMethod: true }
    });

    const raw = settings?.inventoryValuationMethod ?? 'AVERAGE';
    return (raw === 'PEPS' ? 'PEPS' : 'AVERAGE') as ValuationMethod;
  }

  /**
   * Resolve o custo unitário efetivo de um material para fins de snapshot (CMV).
   *
   * AVERAGE: usa averageCost com fallback para costPerUnit / purchasePrice
   * PEPS:    consulta os lotes ENTRY mais antigos com quantityRemaining > 0
   *          e calcula o custo ponderado para a quantidade necessária.
   *          Se não há lotes rastreados, faz fallback para o mesmo caminho do AVERAGE.
   *
   * @param mat            - Objeto material (deve conter os campos de custo)
   * @param organizationId - ID da organização (para buscar lotes PEPS)
   * @param method         - Método de valoração já resolvido (evita query extra)
   * @param quantityNeeded - Quantidade a ser consumida (relevante apenas para PEPS)
   */
  async resolveUnitCost(
    mat: MaterialCostable,
    organizationId: string,
    method: ValuationMethod,
    quantityNeeded?: number
  ): Promise<number> {
    if (method === 'PEPS' && quantityNeeded && quantityNeeded > 0) {
      const pepsResult = await this.computePepsUnitCost(mat.id, organizationId, quantityNeeded);
      if (pepsResult > 0) return pepsResult;
      // Se não há lotes rastreados, cai no AVERAGE como segurança
    }

    return this.resolveAverageCost(mat);
  }

  /**
   * Calcula o custo médio ponderado PEPS para `quantityNeeded` unidades,
   * consumindo os lotes mais antigos primeiro (ordem crescente de createdAt).
   *
   * Não altera `quantityRemaining` — apenas lê. A dedução é feita separadamente
   * pelo ApproveOrderService dentro da transação atômica.
   */
  private async computePepsUnitCost(
    materialId: string,
    organizationId: string,
    quantityNeeded: number
  ): Promise<number> {
    // Busca lotes de entrada (ENTRY) com saldo restante, do mais antigo para o mais novo
    const layers = await this.prisma.stockMovement.findMany({
      where: {
        materialId,
        organizationId,
        type: 'ENTRY',
        isCancelled: false,
        quantityRemaining: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        unitCost: true,
        quantityRemaining: true
      }
    });

    if (layers.length === 0) return 0;

    let remaining = quantityNeeded;
    let totalWeightedCost = 0;
    let totalConsumed = 0;

    for (const layer of layers) {
      if (remaining <= 0) break;

      const available = Number(layer.quantityRemaining);
      const consumed = Math.min(available, remaining);
      const cost = Number(layer.unitCost);

      totalWeightedCost += consumed * cost;
      totalConsumed += consumed;
      remaining -= consumed;
    }

    if (totalConsumed === 0) return 0;

    // Custo médio ponderado dos lotes consumidos (PEPS)
    return totalWeightedCost / totalConsumed;
  }

  /**
   * Debita os lotes PEPS na ordem FIFO, atualizando `quantityRemaining`.
   * Deve ser chamado dentro de uma transação Prisma ($transaction).
   *
   * @param tx             - Instância do Prisma dentro de $transaction
   * @param materialId     - ID do material
   * @param organizationId - ID da organização
   * @param quantityNeeded - Quantidade a ser debitada dos lotes
   */
  async debitPepsLayers(
    tx: any,
    materialId: string,
    organizationId: string,
    quantityNeeded: number
  ): Promise<void> {
    const layers = await tx.stockMovement.findMany({
      where: {
        materialId,
        organizationId,
        type: 'ENTRY',
        isCancelled: false,
        quantityRemaining: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, quantityRemaining: true }
    });

    let remaining = quantityNeeded;

    for (const layer of layers) {
      if (remaining <= 0) break;

      const available = Number(layer.quantityRemaining);
      const toDebit = Math.min(available, remaining);

      await tx.stockMovement.update({
        where: { id: layer.id },
        data: { quantityRemaining: available - toDebit }
      });

      remaining -= toDebit;
    }
  }

  /**
   * Resolve o custo pelo método AVERAGE com hierarquia de fallback completa:
   *   averageCost → costPerUnit → purchasePrice/área → purchasePrice direto → 0
   */
  resolveAverageCost(mat: MaterialCostable): number {
    const avg = Number(mat.averageCost);
    if (avg > 0) return avg;

    const base = Number(mat.costPerUnit);
    if (base > 0) return base;

    const pp  = Number(mat.purchasePrice);
    const pw  = Number(mat.purchaseWidth);
    const ph  = Number(mat.purchaseHeight);
    const fmt = mat.format ?? 'UNIT';

    if (pp > 0) {
      if ((fmt === 'ROLL' || fmt === 'SHEET') && pw > 0 && ph > 0) {
        // Custo por m² = purchasePrice / (largura × altura da embalagem de compra)
        return pp / (pw * ph);
      }
      // Formato UNIT (carimbo, etc.) ou dimensões não informadas: preço direto
      return pp;
    }

    return 0;
  }
}

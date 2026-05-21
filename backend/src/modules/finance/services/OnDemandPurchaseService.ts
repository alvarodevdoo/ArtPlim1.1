/**
 * OnDemandPurchaseService
 *
 * Quando um pedido é aprovado e consome materiais marcados como `sourcingMode = ON_DEMAND`,
 * este serviço gera automaticamente a saída financeira correspondente:
 *
 * - Profile.paymentMode = ON_PURCHASE  → Transaction PAGA imediatamente (sem AccountPayable)
 * - Profile.paymentMode = DAYS_AFTER   → AccountPayable com dueDate = hoje + paymentTerms
 * - Profile.paymentMode = MONTH_DAY    → AccountPayable com dueDate = próximo dia X do mês
 * - Profile.paymentMode = END_OF_MONTH → AccountPayable com dueDate = último dia do mês corrente
 *
 * As compras são AGRUPADAS por fornecedor (um AP/Transaction por fornecedor por pedido).
 */

export interface MaterialUsageEntry {
  materialId: string;
  quantityRequired: number;
  averageCost: number;
}

interface SupplierGroup {
  supplierId: string;
  supplier: any;
  totalAmount: number;
  lines: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    subtotal: number;
  }>;
}

export interface OnDemandGenerationResult {
  accountPayablesCreated: number;
  paidImmediately: number;
  totalAmount: number;
  details: Array<{
    supplierId: string;
    supplierName: string;
    amount: number;
    status: 'PAID' | 'PENDING';
    dueDate: Date;
  }>;
}

export class OnDemandPurchaseService {
  constructor(private readonly prisma: any) {}

  /**
   * Calcula a data de vencimento da AP segundo o paymentMode do fornecedor.
   */
  private computeDueDate(
    mode: string,
    paymentTerms: number | null | undefined,
    paymentDayOfMonth: number | null | undefined,
    referenceDate: Date = new Date()
  ): Date {
    const ref = new Date(referenceDate);
    if (mode === 'DAYS_AFTER') {
      const days = paymentTerms || 30;
      const due = new Date(ref);
      due.setDate(due.getDate() + days);
      return due;
    }
    if (mode === 'MONTH_DAY') {
      const dayOfMonth = paymentDayOfMonth || 10;
      const due = new Date(ref.getFullYear(), ref.getMonth(), dayOfMonth);
      // Se o dia já passou no mês corrente, vai para o próximo mês
      if (due < ref) due.setMonth(due.getMonth() + 1);
      return due;
    }
    if (mode === 'END_OF_MONTH') {
      return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    }
    // Fallback (ON_PURCHASE não deveria chegar aqui, mas devolve hoje)
    return ref;
  }

  /**
   * Executa a geração dentro de uma transação Prisma já aberta.
   *
   * @param tx Transação Prisma do approve
   * @param organizationId
   * @param orderId
   * @param orderNumber
   * @param userId
   * @param materialUsage Materiais consumidos no pedido
   */
  async generateForOrder(
    tx: any,
    organizationId: string,
    orderId: string,
    orderNumber: string,
    userId: string | null,
    materialUsage: MaterialUsageEntry[]
  ): Promise<OnDemandGenerationResult> {
    const result: OnDemandGenerationResult = {
      accountPayablesCreated: 0,
      paidImmediately: 0,
      totalAmount: 0,
      details: []
    };

    if (materialUsage.length === 0) return result;

    const materialIds = materialUsage.map(m => m.materialId);

    // Buscar materiais ON_DEMAND com fornecedor primário
    const materials = await tx.material.findMany({
      where: {
        id: { in: materialIds },
        sourcingMode: 'ON_DEMAND',
        primarySupplierId: { not: null }
      },
      select: {
        id: true,
        name: true,
        unit: true,
        controlUnit: true,
        currentStock: true,
        primarySupplierId: true,
        primarySupplier: {
          select: {
            id: true,
            name: true,
            paymentMode: true,
            paymentTerms: true,
            paymentDayOfMonth: true,
            defaultPaymentMethodId: true
          }
        },
        suppliers: {
          where: { active: true },
          select: { supplierId: true, costPrice: true }
        }
      }
    });

    if (materials.length === 0) return result;

    const materialById = new Map(materials.map((m: any) => [m.id, m]));

    // Agrupar consumo por fornecedor primário
    const groups = new Map<string, SupplierGroup>();
    for (const usage of materialUsage) {
      const mat: any = materialById.get(usage.materialId);
      if (!mat || !mat.primarySupplierId) continue;

      // Usar o costPrice do MaterialSupplier do fornecedor primário se houver;
      // senão, cair no averageCost calculado pelo aprovador.
      const supplierLink = mat.suppliers.find((s: any) => s.supplierId === mat.primarySupplierId);
      const unitCost = supplierLink?.costPrice != null
        ? Number(supplierLink.costPrice)
        : usage.averageCost;
      const subtotal = unitCost * usage.quantityRequired;

      let group = groups.get(mat.primarySupplierId);
      if (!group) {
        group = {
          supplierId: mat.primarySupplierId,
          supplier: mat.primarySupplier,
          totalAmount: 0,
          lines: []
        };
        groups.set(mat.primarySupplierId, group);
      }
      group.totalAmount += subtotal;
      group.lines.push({
        materialId: mat.id,
        materialName: mat.name,
        quantity: usage.quantityRequired,
        unit: mat.controlUnit || mat.unit || 'un',
        unitCost,
        subtotal
      });
    }

    // Para cada fornecedor, cria sempre um AccountPayable.
    // Se paymentMode = ON_PURCHASE, o AP já nasce PAGO (status = PAID, dueDate = hoje).
    // Caso contrário, fica PENDING com dueDate computado conforme o modo.
    for (const group of groups.values()) {
      const mode = group.supplier.paymentMode || 'ON_PURCHASE';
      const linesNote = group.lines
        .map(l => `${l.materialName} (${l.quantity} ${l.unit} × R$ ${l.unitCost.toFixed(2)})`)
        .join('; ');
      const baseNote = `Auto — Pedido ${orderNumber} | ${linesNote}`;
      const isImmediate = mode === 'ON_PURCHASE';
      const today = new Date();
      const dueDate = isImmediate
        ? today
        : this.computeDueDate(
            mode,
            group.supplier.paymentTerms,
            group.supplier.paymentDayOfMonth,
            today
          );

      await tx.accountPayable.create({
        data: {
          organizationId,
          supplierId: group.supplierId,
          amount: group.totalAmount,
          dueDate,
          status: isImmediate ? 'PAID' : 'PENDING',
          notes: baseNote
        }
      });

      result.accountPayablesCreated++;
      if (isImmediate) result.paidImmediately++;
      result.totalAmount += group.totalAmount;
      result.details.push({
        supplierId: group.supplierId,
        supplierName: group.supplier.name,
        amount: group.totalAmount,
        status: isImmediate ? 'PAID' : 'PENDING',
        dueDate
      });
    }

    return result;
  }
}

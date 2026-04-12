import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

interface EntryInput {
  materialId: string;
  quantity: number;
  unitCost: number;
  userId: string;
  totalCost?: number;
  notes?: string;
  documentKey?: string;
  documentUrl?: string;
  justification?: string;
  supplierId?: string;
}

interface ConsumptionInput {
  materialId: string;
  quantity: number;
  machineId: string;
  machineCounter?: number;
  notes?: string;
}

export class StockMovementService {
  constructor(private prisma: PrismaClient) {}

  async registerEntry(organizationId: string, data: EntryInput) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: data.materialId }
      });

      if (!material) throw new AppError('Material não encontrado', 404);
      if (material.organizationId !== organizationId) throw new AppError('Acesso não autorizado', 403);

      const currentStock = Number(material.currentStock ?? 0);
      const averageCost = Number(material.averageCost ?? 0);
      const newQuantity = data.quantity;
      const newUnitCost = data.unitCost;

      // Validar obrigatoriedade de nota fiscal nas configurações
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId } });
      if (settings?.requireDocumentKeyForEntry && !data.documentKey) {
        throw new AppError('A chave da nota ou cupom fiscal é obrigatória conforme as configurações da empresa.', 400);
      }

      // Cálculo do Custo Médio Ponderado
      const currentTotalValue = currentStock * averageCost;
      const newTotalValue = newQuantity * newUnitCost;
      const totalStockAfterEntry = currentStock + newQuantity;
      const newAverageCost = totalStockAfterEntry > 0
        ? (currentTotalValue + newTotalValue) / totalStockAfterEntry
        : 0;

      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          materialId: data.materialId,
          userId: data.userId,
          type: 'ENTRY',
          quantity: new Prisma.Decimal(newQuantity),
          unitCost: new Prisma.Decimal(newUnitCost),
          totalCost: new Prisma.Decimal(data.totalCost ?? (newQuantity * newUnitCost)),
          oldQuantity: new Prisma.Decimal(currentStock),
          oldUnitCost: new Prisma.Decimal(averageCost),
          notes: data.notes,
          justification: data.justification,
          documentKey: data.documentKey,
          documentUrl: data.documentUrl,
          supplierId: data.supplierId,
          quantityRemaining: new Prisma.Decimal(newQuantity),
        }
      });

      await tx.material.update({
        where: { id: data.materialId },
        data: {
          currentStock: new Prisma.Decimal(totalStockAfterEntry),
          averageCost: new Prisma.Decimal(newAverageCost),
        }
      });

      return movement;
    });
  }

  async registerInternalConsumption(organizationId: string, userId: string, data: ConsumptionInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar conta contábil 4.1.1.04 (BLOQUEIO RÍGIDO)
      const chartAccount = await tx.chartOfAccount.findFirst({
        where: {
          organizationId,
          OR: [
            { code: '4.1.1.04' },
            { code: { startsWith: '4.1.1.04.' } }
          ]
        }
      });

      if (!chartAccount) {
        throw new AppError(
          'Conta contábil de Custos Indiretos (4.1.1.04) não encontrada. Configure o Plano de Contas antes de registrar baixas de consumo.',
          400
        );
      }

      // 2. Buscar Material
      const material = await tx.material.findUnique({
        where: { id: data.materialId }
      });

      if (!material) throw new AppError('Material não encontrado', 404);
      if (material.organizationId !== organizationId) throw new AppError('Acesso não autorizado', 403);

      const currentStock = Number(material.currentStock ?? 0);
      const consumeQuantity = data.quantity;

      if (currentStock < consumeQuantity && !material.sellWithoutStock) {
        throw new AppError(
          `Estoque insuficiente. Disponível: ${currentStock} ${material.unit}. Solicitado: ${consumeQuantity} ${material.unit}.`,
          400
        );
      }

      // --- ALGORITMO PEPS (FIFO) ---
      // Localizar lotes com saldo disponível (mais antigos primeiro)
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

      let remainingToConsume = consumeQuantity;
      let totalValueCalculated = 0;
      const consumedPortions = [];

      for (const batch of activeBatches) {
        if (remainingToConsume <= 0) break;

        const batchQty = Number(batch.quantityRemaining);
        const amountToTakeFromThisBatch = Math.min(batchQty, remainingToConsume);

        // Atualizar saldo do lote
        await tx.stockMovement.update({
          where: { id: batch.id },
          data: { 
            quantityRemaining: new Prisma.Decimal(batchQty - amountToTakeFromThisBatch) 
          }
        });

        totalValueCalculated += amountToTakeFromThisBatch * Number(batch.unitCost);
        consumedPortions.push({
          batchId: batch.id,
          quantity: amountToTakeFromThisBatch,
          unitCost: batch.unitCost
        });

        remainingToConsume -= amountToTakeFromThisBatch;
      }

      // Se ainda sobrou algo para consumir (ex: estoque negativo permitido)
      // usamos o custo médio ou o último custo como fallback para a parte negativa
      if (remainingToConsume > 0) {
        const fallbackCost = Number(material.averageCost || 0);
        totalValueCalculated += remainingToConsume * fallbackCost;
        console.warn(`[FIFO] Consumo excedeu lotes disponíveis. ${remainingToConsume} unidades avaliadas ao custo médio.`);
      }

      const calculatedUnitCost = totalValueCalculated / consumeQuantity;
      const newStock = currentStock - consumeQuantity;

      // 3. Atualiza o estoque do material
      await tx.material.update({
        where: { id: material.id },
        data: { currentStock: new Prisma.Decimal(newStock) }
      });

      // 4. Registra a Baixa (StockMovement)
      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          materialId: material.id,
          userId,
          type: 'INTERNAL_CONSUMPTION',
          quantity: new Prisma.Decimal(consumeQuantity),
          unitCost: new Prisma.Decimal(calculatedUnitCost),
          totalCost: new Prisma.Decimal(totalValueCalculated),
          oldQuantity: new Prisma.Decimal(currentStock),
          oldUnitCost: new Prisma.Decimal(material.averageCost || 0),
          machineId: data.machineId,
          machineCounter: data.machineCounter,
          notes: data.notes + (consumedPortions.length > 0 ? `\n[PEPS] Consumido de ${consumedPortions.length} lote(s).` : '')
        }
      });

      // 5. Integração Financeira — Lançar Despesa no DRE
      const financialAccount = await tx.account.findFirst({
        where: { organizationId, active: true }
      });

      if (!financialAccount) {
        throw new AppError('Nenhuma conta bancária/caixa configurada. Crie uma conta no menu Financeiro.', 400);
      }

      await tx.transaction.create({
        data: {
          organizationId,
          accountId: financialAccount.id,
          type: 'EXPENSE',
          status: 'PAID',
          amount: new Prisma.Decimal(totalCostOfConsumption),
          description: `Consumo Interno: ${material.name} (Qtde: ${consumeQuantity} ${material.unit})`,
          paidAt: new Date(),
          userId,
          auditNotes: `StockMovement ID: ${movement.id} | Máquina: ${data.machineId}`,
        }
      });

      return movement;
    });
  }

  async registerAdjustment(organizationId: string, userId: string, data: { materialId: string; quantity: number; averageCost: number; notes?: string; justification?: string; documentUrl?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: data.materialId }
      });

      if (!material) throw new AppError('Material não encontrado', 404);
      if (material.organizationId !== organizationId) throw new AppError('Acesso não autorizado', 403);

      // Gerar número único para o ajuste
      const timestamp = Date.now();
      const movementNumber = `ADJ-${timestamp}-${Math.floor(Math.random() * 1000)}`;

      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          materialId: data.materialId,
          userId,
          type: 'ADJUSTMENT',
          quantity: new Prisma.Decimal(data.quantity),
          unitCost: new Prisma.Decimal(data.averageCost),
          totalCost: new Prisma.Decimal(data.quantity * data.averageCost),
          oldQuantity: new Prisma.Decimal(material.currentStock ?? 0),
          oldUnitCost: new Prisma.Decimal(material.averageCost ?? 0),
          notes: data.notes,
          justification: data.justification,
          movementNumber,
          documentUrl: data.documentUrl,
        }
      });

      await tx.material.update({
        where: { id: data.materialId },
        data: {
          currentStock: new Prisma.Decimal(data.quantity),
          averageCost: new Prisma.Decimal(data.averageCost),
        }
      });

      return movement;
    });
  }

  async cancelMovement(organizationId: string, userId: string, movementId: string, justification: string) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({
        where: { id: movementId },
        include: { material: true }
      });

      if (!movement) throw new AppError('Movimentação não encontrada', 404);
      if (movement.organizationId !== organizationId) throw new AppError('Acesso não autorizado', 403);
      if (movement.isCancelled) throw new AppError('Movimentação já cancelada', 400);

      const material = movement.material;
      let newStock = Number(material.currentStock ?? 0);
      let newAverageCost = Number(material.averageCost ?? 0);

      // Reverter para o estado anterior usando oldQuantity e oldUnitCost
      if (movement.oldQuantity !== null && movement.oldUnitCost !== null) {
        newStock = Number(movement.oldQuantity);
        newAverageCost = Number(movement.oldUnitCost);
      } else {
        // Fallback para lógica manual se não houver dados anteriores (legado)
        const currentStock = newStock;
        const averageCost = newAverageCost;
        const movementQty = Number(movement.quantity);
        const movementUnitCost = Number(movement.unitCost);

        if (movement.type === 'ENTRY') {
          newStock = currentStock - movementQty;
          if (newStock > 0) {
            const totalValueBeforeCancel = currentStock * averageCost;
            const totalValueMovement = movementQty * movementUnitCost;
            newAverageCost = (totalValueBeforeCancel - totalValueMovement) / newStock;
          } else {
            newAverageCost = 0;
          }
        } else if (movement.type === 'INTERNAL_CONSUMPTION') {
          newStock = currentStock + movementQty;
        } else if (movement.type === 'ADJUSTMENT') {
          throw new AppError('Não é possível estornar este ajuste antigo sem dados de histórico.', 400);
        }
      }

      await tx.material.update({
        where: { id: material.id },
        data: {
          currentStock: new Prisma.Decimal(newStock),
          averageCost: new Prisma.Decimal(newAverageCost),
        }
      });

      return tx.stockMovement.update({
        where: { id: movementId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledById: userId,
          notes: movement.notes + `\n[CANCELADO em ${new Date().toLocaleString()}] Justificativa: ${justification}`
        }
      });
    });
  }

  async registerReceipt(organizationId: string, userId: string, data: { supplierId: string; notes?: string; documentKey?: string; items: EntryInput[] }) {
    return this.prisma.$transaction(async (tx) => {
      // Validar obrigatoriedade de nota fiscal nas configurações
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId } });
      if (settings?.requireDocumentKeyForEntry && !data.documentKey) {
        throw new AppError('A chave da nota ou cupom fiscal é obrigatória para recebimentos em lote.', 400);
      }

      const results = [];
      for (const item of data.items) {
        // Reutilizamos a lógica de entrada para cada item
        const material = await tx.material.findUnique({ where: { id: item.materialId } });
        if (!material) throw new AppError(`Material ${item.materialId} não encontrado`, 404);

        const currentStock = Number(material.currentStock ?? 0);
        const averageCost = Number(material.averageCost ?? 0);
        const totalCostPerItem = item.totalCost ?? (item.quantity * item.unitCost);
        const totalStockAfterEntry = currentStock + item.quantity;
        const newAverageCost = totalStockAfterEntry > 0
          ? (currentStock * averageCost + totalCostPerItem) / totalStockAfterEntry
          : 0;

        const movement = await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: item.materialId,
            userId,
            type: 'ENTRY',
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitCost),
            totalCost: new Prisma.Decimal(item.totalCost ?? (item.quantity * item.unitCost)),
            oldQuantity: new Prisma.Decimal(currentStock),
            oldUnitCost: new Prisma.Decimal(averageCost),
            notes: item.notes || data.notes,
            documentKey: item.documentKey || data.documentKey,
            supplierId: data.supplierId,
            quantityRemaining: new Prisma.Decimal(item.quantity),
          }
        });

        await tx.material.update({
          where: { id: item.materialId },
          data: {
            currentStock: new Prisma.Decimal(totalStockAfterEntry),
            averageCost: new Prisma.Decimal(newAverageCost),
          }
        });
        results.push(movement);
      }
      return results;
    });
  }

  async listMovements(organizationId: string, filters?: { materialId?: string; type?: string; limit?: number }) {
    return this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        ...(filters?.materialId ? { materialId: filters.materialId } : {}),
        ...(filters?.type ? { type: filters.type as any } : {}),
      },
      include: {
        material: {
          select: { 
            id: true, 
            name: true, 
            unit: true, 
            category: {
              select: { id: true, name: true }
            }
          }
        },
        machine: {
          select: { id: true, name: true, type: true }
        },
        supplier: {
          select: { id: true, name: true }
        },
        user: {
          select: { id: true, name: true }
        },
        cancelledBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50
    });
  }
}

import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

interface EntryInput {
  materialId: string;
  quantity: number;
  unitCost: number;
  totalCost?: number;
  notes?: string;
  documentKey?: string;
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
          type: 'ENTRY',
          quantity: new Prisma.Decimal(newQuantity),
          unitCost: new Prisma.Decimal(newUnitCost),
          totalCost: new Prisma.Decimal(data.totalCost ?? (newQuantity * newUnitCost)),
          notes: data.notes,
          documentKey: data.documentKey,
          supplierId: data.supplierId,
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
      const averageCost = Number(material.averageCost ?? 0);
      const consumeQuantity = data.quantity;

      if (currentStock < consumeQuantity && !material.sellWithoutStock) {
        throw new AppError(
          `Estoque insuficiente. Disponível: ${currentStock} ${material.unit}. Solicitado: ${consumeQuantity} ${material.unit}.`,
          400
        );
      }

      const totalCostOfConsumption = consumeQuantity * averageCost;
      const newStock = currentStock - consumeQuantity;

      // 3. Atualiza o estoque
      await tx.material.update({
        where: { id: material.id },
        data: { currentStock: new Prisma.Decimal(newStock) }
      });

      // 4. Registra a Baixa (StockMovement)
      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          materialId: material.id,
          type: 'INTERNAL_CONSUMPTION',
          quantity: new Prisma.Decimal(consumeQuantity),
          unitCost: new Prisma.Decimal(averageCost),
          totalCost: new Prisma.Decimal(totalCostOfConsumption),
          machineId: data.machineId,
          machineCounter: data.machineCounter,
          notes: data.notes
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

  async registerAdjustment(organizationId: string, data: { materialId: string; quantity: number; averageCost: number; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: data.materialId }
      });

      if (!material) throw new AppError('Material não encontrado', 404);
      if (material.organizationId !== organizationId) throw new AppError('Acesso não autorizado', 403);

      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          materialId: data.materialId,
          type: 'ADJUSTMENT',
          quantity: new Prisma.Decimal(data.quantity),
          unitCost: new Prisma.Decimal(data.averageCost),
          totalCost: new Prisma.Decimal(data.quantity * data.averageCost),
          notes: data.notes,
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
            type: 'ENTRY',
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitCost),
            totalCost: new Prisma.Decimal(item.totalCost ?? (item.quantity * item.unitCost)),
            notes: item.notes || data.notes,
            documentKey: item.documentKey || data.documentKey,
            supplierId: data.supplierId,
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
          select: { id: true, name: true, unit: true, category: true }
        },
        machine: {
          select: { id: true, name: true, type: true }
        },
        supplier: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50
    });
  }
}

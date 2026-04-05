import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';
import { StockMovementService } from '../../wms/services/StockMovementService';

interface NFeImportPayload {
  chaveAcesso: string;
  dataEmissao: string;
  valorTotalNota: number;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    endereco?: any;
  };
  items: Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    custoEfetivoUnitario?: number;
    unidade?: string;
    ncm?: string;
    ean?: string;
    custosAcessorios?: {
      frete?: number;
      ipi?: number;
      st?: number;
      difal?: number;
    };
    mappedMaterialId?: string; // O UUID do material interno no ArtPlim
    createNew?: boolean; // Caso o usuário tenha marcado para criar um novo insumo ao invés de buscar existente
    categoryId?: string;
    materialTypeId?: string;
    inventoryAccountId?: string;
    expenseAccountId?: string;
    skip?: boolean;
  }>;
  costDistributionMode?: 'STRICT' | 'REDISTRIBUTE';
}

export class NFeImportService {
  constructor(private prisma: PrismaClient) {}

  async importNFe(organizationId: string, userId: string, payload: NFeImportPayload) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Achar ou Criar Perfil de Fornecedor
      let supplier = await tx.profile.findFirst({
        where: {
          organizationId,
          document: payload.emitente.cnpj
        }
      });

      if (!supplier) {
        supplier = await tx.profile.create({
          data: {
            organizationId,
            name: payload.emitente.nomeFantasia || payload.emitente.razaoSocial,
            document: payload.emitente.cnpj,
            type: 'COMPANY', // Forçando juridical pra Cnpj
            isSupplier: true,
            address: payload.emitente.endereco?.logradouro,
            addressNumber: payload.emitente.endereco?.numero?.toString(),
            city: payload.emitente.endereco?.cidade,
            state: payload.emitente.endereco?.uf,
            zipCode: payload.emitente.endereco?.cep?.toString(),
            phone: payload.emitente.endereco?.telefone?.toString(),
          }
        });
      }

      // 2. Criar a Receita/Entrada de Material
      const receipt = await tx.materialReceipt.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          invoiceNumber: payload.chaveAcesso, // Podemos guardar a chave
          totalAmount: new Prisma.Decimal(payload.valorTotalNota),
          issueDate: new Date(payload.dataEmissao || new Date()),
          status: 'BILLED'
        }
      });

      const movementService = new StockMovementService(tx as any);
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId } });
      const valuationMethod = settings?.inventoryValuationMethod || 'AVERAGE';

      // 3. Calcular Rateio de Custos de Itens Ignorados (se habilitado)
      let extraCostToRedistribute = 0;
      const importedItems = payload.items.filter(i => !i.skip);
      const skippedItems = payload.items.filter(i => i.skip);

      if (payload.costDistributionMode === 'REDISTRIBUTE' && skippedItems.length > 0) {
        extraCostToRedistribute = skippedItems.reduce((acc, item) => {
          const extras = item.custosAcessorios;
          const totalExtras = (extras?.frete || 0) + (extras?.ipi || 0) + (extras?.st || 0) + (extras?.difal || 0);
          return acc + totalExtras;
        }, 0);
      }

      const totalImportedValue = importedItems.reduce((acc, i) => acc + i.valorTotal, 0);

      // 4. Processar Itens
      for (const item of payload.items) {
        if (item.skip) continue;

        let materialId = item.mappedMaterialId;

        if (item.createNew) {
          const importedUnit = (item.unidade || 'un').toLowerCase();
          let controlUnit = 'UN';
          let consumptionRule = 'FIXED_UNIT';
          let format = 'UNIT';

          if (importedUnit === 'm2' || importedUnit === 'm²') {
            controlUnit = 'M2';
            consumptionRule = 'PRODUCT_AREA';
            format = 'ROLL';
          } else if (importedUnit === 'm' || importedUnit === 'ml') {
            controlUnit = 'ML';
            consumptionRule = 'PERIMETER';
            format = 'ROLL';
          } else if (importedUnit === 'fl' || importedUnit === 'folha') {
            format = 'SHEET';
          }

          // Herança Contábil: Se não vier conta, busca o padrão da categoria
          const selectedCategory = await tx.category.findUnique({ 
            where: { id: item.categoryId || (await tx.category.findFirst({ where: { organizationId, name: { contains: 'Insumos', mode: 'insensitive' } } }))?.id || (await tx.category.findFirst({ where: { organizationId } }))?.id || '' } 
          });

          // Cadastrar o Insumo Automaticamente
          const newMaterial = await tx.material.create({
            data: {
              organizationId,
              name: item.descricao,
              format: format as any,
              costPerUnit: new Prisma.Decimal(item.valorUnitario),
              unit: item.unidade || 'un', 
              controlUnit: controlUnit as any,
              defaultConsumptionRule: consumptionRule as any,
              categoryId: selectedCategory?.id || '',
              materialTypeId: item.materialTypeId,
              inventoryAccountId: item.inventoryAccountId || selectedCategory?.inventoryAccountId,
              expenseAccountId: item.expenseAccountId || selectedCategory?.expenseAccountId,
              trackStock: true,
              ncm: item.ncm,
              ean: item.ean,
            }
          });
          materialId = newMaterial.id;
        }

        const material = await tx.material.findUnique({ where: { id: materialId } });
        if (!material) throw new AppError(`Material não encontrado para o mapeamento: ${item.descricao}`);

        // Criar item da Receipt
        await tx.materialReceiptItem.create({
          data: {
            receiptId: receipt.id,
            materialId: material.id,
            quantity: new Prisma.Decimal(item.quantidade),
            unitPrice: new Prisma.Decimal(item.valorUnitario),
            totalPrice: new Prisma.Decimal(item.valorTotal)
          }
        });

        // Garantir o vínculo Fornecedor <-> Insumo
        await tx.materialSupplier.upsert({
          where: { materialId_supplierId: { materialId: material.id, supplierId: supplier.id } },
          update: { costPrice: new Prisma.Decimal(item.valorUnitario), supplierCode: item.codigo },
          create: {
            materialId: material.id,
            supplierId: supplier.id,
            supplierCode: item.codigo,
            costPrice: new Prisma.Decimal(item.valorUnitario)
          }
        });

        // Lógica de Estoque e Custeio
        let itemExtraCostFromSkip = 0;
        if (extraCostToRedistribute > 0 && totalImportedValue > 0) {
          itemExtraCostFromSkip = (item.valorTotal / totalImportedValue) * extraCostToRedistribute;
        }

        const baseEffectiveCost = item.custoEfetivoUnitario ?? item.valorUnitario;
        const totalEffectiveCostForItem = (baseEffectiveCost * item.quantidade) + itemExtraCostFromSkip;
        const finalEffectiveUnitCost = item.quantidade > 0 ? (totalEffectiveCostForItem / item.quantidade) : 0;

        const currentStock = Number(material.currentStock ?? 0);
        const averageCost = Number(material.averageCost ?? 0);
        const totalStockAfterEntry = currentStock + item.quantidade;
        let newCost = averageCost;

        if (valuationMethod === 'AVERAGE') {
          const currentTotalValue = currentStock * averageCost;
          const newTotalValue = item.quantidade * finalEffectiveUnitCost;
          newCost = totalStockAfterEntry > 0 ? (currentTotalValue + newTotalValue) / totalStockAfterEntry : 0;
        } else if (valuationMethod === 'PEPS') {
          if (currentStock <= 0) {
            newCost = finalEffectiveUnitCost;
          }
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: material.id,
            type: 'ENTRY',
            quantity: new Prisma.Decimal(item.quantidade),
            unitCost: new Prisma.Decimal(finalEffectiveUnitCost),
            totalCost: new Prisma.Decimal(totalEffectiveCostForItem),
            notes: `NF-e Chave: ${payload.chaveAcesso}${itemExtraCostFromSkip > 0 ? ' | Inclui Rateio de Itens Ignorados' : ''}`,
            documentKey: payload.chaveAcesso,
            supplierId: supplier.id,
          }
        });

        await tx.material.update({
          where: { id: material.id },
          data: {
            currentStock: new Prisma.Decimal(totalStockAfterEntry),
            averageCost: new Prisma.Decimal(newCost),
          }
        });
      }

      return receipt;
    });
  }
}

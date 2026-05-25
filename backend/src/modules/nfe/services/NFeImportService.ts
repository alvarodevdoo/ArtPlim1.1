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
    // Dados opcionais quando o usuário escolhe criar o material via NF-e
    minStockQuantity?: number;
    width?: number;
    height?: number;
  }>;
  costDistributionMode?: 'STRICT' | 'REDISTRIBUTE';
  // Custos pagos fora da NF-e (ex.: frete pago em separado, impostos adicionais).
  // São sempre rateados proporcionalmente ao valor de cada item importado.
  extraFreightCost?: number;
  extraTaxesCost?: number;
  extraOtherCost?: number;
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

      // 2. Verificar histórico de importações desta mesma chave (parcial ou completa)
      // Se algum item já foi trazido em uma importação anterior, ele é pulado aqui também.
      const previousReceipts = await tx.materialReceipt.findMany({
        where: { organizationId, invoiceNumber: payload.chaveAcesso },
        include: { items: { select: { notes: true } } }
      });
      const previouslyImportedCodes = new Set<string>();
      for (const r of previousReceipts) {
        for (const it of r.items) {
          try {
            const meta = it.notes ? JSON.parse(it.notes) : null;
            if (meta?.nfeItemCode) previouslyImportedCodes.add(String(meta.nfeItemCode));
          } catch {}
        }
      }

      // Se TODOS os itens não-descartados já foram importados antes, aborta com mensagem clara.
      const itemsToImport = payload.items.filter(i => !i.skip && !previouslyImportedCodes.has(String(i.codigo)));
      if (itemsToImport.length === 0 && previousReceipts.length > 0) {
        throw new AppError('Esta NF-e já foi totalmente importada anteriormente. Nada novo a registrar.');
      }

      // Criar a Receita/Entrada de Material
      const receiptNotes = {
        nfeNumero: (payload as any).numero || null,
        importedAt: new Date().toISOString(),
        skippedItems: payload.items
          .filter(i => i.skip)
          .map(i => ({ codigo: i.codigo, descricao: i.descricao })),
        extras: {
          frete: payload.extraFreightCost || 0,
          impostos: payload.extraTaxesCost || 0,
          outras: payload.extraOtherCost || 0
        },
        isReimport: previousReceipts.length > 0
      };

      const receipt = await tx.materialReceipt.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          invoiceNumber: payload.chaveAcesso,
          totalAmount: new Prisma.Decimal(payload.valorTotalNota),
          issueDate: new Date(payload.dataEmissao || new Date()),
          status: 'BILLED',
          notes: JSON.stringify(receiptNotes)
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

      // Sempre incluir custos extras pagos fora da nota no pool de rateio
      const externalExtras =
        (payload.extraFreightCost || 0)
        + (payload.extraTaxesCost || 0)
        + (payload.extraOtherCost || 0);
      extraCostToRedistribute += externalExtras;

      const totalImportedValue = importedItems.reduce((acc, i) => acc + i.valorTotal, 0);

      // 4. Processar Itens
      for (const item of payload.items) {
        if (item.skip) continue;
        // Dedupe: itens com mesmo código já trazidos por outra importação da mesma chave
        if (previouslyImportedCodes.has(String(item.codigo))) continue;

        let materialId = item.mappedMaterialId;

        if (item.createNew) {
          // Se já existe um material com o mesmo nome (case-insensitive) na organização,
          // reutiliza em vez de quebrar a transação com violação de unique constraint.
          // Caso esteja inativo (soft-deleted), reativa e aplica os dados ajustados na NF-e.
          const existing = await tx.material.findFirst({
            where: {
              organizationId,
              name: { equals: item.descricao, mode: 'insensitive' }
            },
            select: { id: true, active: true }
          });
          if (existing) {
            const updateData: any = {};
            if (!existing.active) {
              // Material foi removido (soft-delete) e está sendo recadastrado.
              // Zera o estoque e custo médio para que a entrada da NF-e seja a base nova,
              // sem acumular o saldo "fantasma" anterior à remoção.
              updateData.active = true;
              updateData.currentStock = new Prisma.Decimal(0);
              updateData.averageCost = new Prisma.Decimal(0);
            }
            // Atualiza dados que o usuário pode ter ajustado no fluxo de entrada
            updateData.purchasePrice = new Prisma.Decimal(item.valorUnitario);
            updateData.primarySupplierId = supplier.id;
            if (item.categoryId) updateData.categoryId = item.categoryId;
            if (item.materialTypeId) updateData.materialTypeId = item.materialTypeId;
            if (item.inventoryAccountId) updateData.inventoryAccountId = item.inventoryAccountId;
            if (item.expenseAccountId) updateData.expenseAccountId = item.expenseAccountId;
            if (item.minStockQuantity !== undefined && item.minStockQuantity !== null) {
              updateData.minStockQuantity = item.minStockQuantity;
            }
            if (item.width !== undefined && item.width !== null) {
              updateData.width = item.width;
              updateData.purchaseWidth = item.width;
            }
            if (item.height !== undefined && item.height !== null) {
              updateData.height = item.height;
              updateData.purchaseHeight = item.height;
            }
            if (item.ncm) updateData.ncm = item.ncm;
            if (item.ean) updateData.ean = item.ean;

            await tx.material.update({
              where: { id: existing.id },
              data: updateData
            });
            materialId = existing.id;
          } else {
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
              purchasePrice: new Prisma.Decimal(item.valorUnitario),
              primarySupplierId: supplier.id,
              unit: item.unidade || 'un',
              purchaseUnit: item.unidade || 'un',
              controlUnit: controlUnit as any,
              defaultConsumptionRule: consumptionRule as any,
              categoryId: selectedCategory?.id || '',
              materialTypeId: item.materialTypeId,
              inventoryAccountId: item.inventoryAccountId || selectedCategory?.inventoryAccountId,
              expenseAccountId: item.expenseAccountId || selectedCategory?.expenseAccountId,
              trackStock: true,
              ncm: item.ncm,
              ean: item.ean,
              ...(item.minStockQuantity !== undefined && item.minStockQuantity !== null && {
                minStockQuantity: item.minStockQuantity
              }),
              ...(item.width !== undefined && item.width !== null && {
                width: item.width,
                purchaseWidth: item.width
              }),
              ...(item.height !== undefined && item.height !== null && {
                height: item.height,
                purchaseHeight: item.height
              }),
            }
          });
          materialId = newMaterial.id;
          } // fecha o else do "material já existe"
        }

        const material = await tx.material.findUnique({ where: { id: materialId } });
        if (!material) throw new AppError(`Material não encontrado para o mapeamento: ${item.descricao}`);

        // Criar item da Receipt — guardar o código original da NF-e para dedupe futuro
        await tx.materialReceiptItem.create({
          data: {
            receiptId: receipt.id,
            materialId: material.id,
            quantity: new Prisma.Decimal(item.quantidade),
            unitPrice: new Prisma.Decimal(item.valorUnitario),
            totalPrice: new Prisma.Decimal(item.valorTotal),
            notes: JSON.stringify({ nfeItemCode: item.codigo, nfeItemDesc: item.descricao })
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

        const currentStock = Number(material.currentStock ?? 0);
        const averageCost = Number(material.averageCost ?? 0);
        
        const multiplier = Number(material.multiplicador_padrao_entrada ?? 1);
        const conversionFactor = Number(material.conversionFactor ?? 1);
        const isMeasurementUnit = ['M2', 'M', 'ML'].includes(material.controlUnit || '');
        
        // Área Total de 1 Chapa (ex: 5.08m2)
        const areaTotalDaChapa = multiplier * conversionFactor;

        // Quantidade Efetiva para o Estoque:
        // Agora confiamos no valor calculado e confirmado pelo usuário no frontend.
        const stockQuantityToAdd = item.quantidade;

        // Lógica de Preço e Custeio:
        let itemExtraCostFromSkip = 0;
        if (extraCostToRedistribute > 0 && totalImportedValue > 0) {
          itemExtraCostFromSkip = (item.valorTotal / totalImportedValue) * extraCostToRedistribute;
        }

        const baseEffectiveCost = item.custoEfetivoUnitario ?? item.valorUnitario;
        const totalEffectiveCostForItem = (baseEffectiveCost * item.quantidade) + itemExtraCostFromSkip;
        
        const finalEffectiveUnitInternalCost = stockQuantityToAdd > 0 ? (totalEffectiveCostForItem / stockQuantityToAdd) : 0;
        const totalStockAfterEntry = currentStock + stockQuantityToAdd;

        let newCost = averageCost;
        if (valuationMethod === 'AVERAGE') {
          const currentTotalValue = currentStock * averageCost;
          const newTotalValue = totalEffectiveCostForItem; 
          newCost = totalStockAfterEntry > 0 ? (currentTotalValue + newTotalValue) / totalStockAfterEntry : 0;
        } else if (valuationMethod === 'PEPS') {
          if (currentStock <= 0) {
            newCost = finalEffectiveUnitInternalCost;
          }
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: material.id,
            type: 'ENTRY',
            quantity: new Prisma.Decimal(stockQuantityToAdd),
            unitCost: new Prisma.Decimal(finalEffectiveUnitInternalCost),
            totalCost: new Prisma.Decimal(totalEffectiveCostForItem),
            notes: `NF-e Chave: ${payload.chaveAcesso}${itemExtraCostFromSkip > 0 ? ' | Inclui rateio de custos extras' : ''}${externalExtras > 0 ? ' (frete/impostos pagos fora da nota)' : ''}`,
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

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
    mappedMaterialId: string; // O UUID do material interno no ArtPlim
    createNew?: boolean; // Caso o usuário tenha marcado para criar um novo insumo ao invés de buscar existente
    newMaterialCategory?: string;
  }>;
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
            zipCode: payload.emitente.endereco?.cep,
            phone: payload.emitente.endereco?.telefone,
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

      // 3. Processar Itens
      for (const item of payload.items) {
        let materialId = item.mappedMaterialId;

        if (item.createNew) {
          // Cadastrar o Insumo Automaticamente
          const newMaterial = await tx.material.create({
            data: {
              organizationId,
              name: item.descricao,
              format: 'UNIT',
              costPerUnit: new Prisma.Decimal(item.valorUnitario),
              unit: 'un', // Assumimos unidade por padrão pra nota
              categoryId: item.newMaterialCategory || 'ID_DA_CATEGORIA_OUTROS', // Categoria
              trackStock: true,
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
        const currentStock = Number(material.currentStock ?? 0);
        const averageCost = Number(material.averageCost ?? 0);
        const totalStockAfterEntry = currentStock + item.quantidade;
        let newCost = averageCost;

        if (valuationMethod === 'AVERAGE') {
          const currentTotalValue = currentStock * averageCost;
          const newTotalValue = item.quantidade * item.valorUnitario;
          newCost = totalStockAfterEntry > 0 ? (currentTotalValue + newTotalValue) / totalStockAfterEntry : 0;
        } else if (valuationMethod === 'PEPS') {
          // PEPS simples: Mantém o custo de entrada para lote visual? 
          // O custo médio da ficha técnica muitas vezes acaba puxando 'averageCost'.
          // No PEPS, a precificação puxaria lotes, mas vamos atualizar o averageCost com o preço mais recente por segurança provisória ou não mudar.
          // Para PEPS restrito, o averageCost pode representar apenas o custo do lote mais antigo a ser consumido. 
          // Se o estoque estava zerado, passamos a usar o da nota.
          if (currentStock <= 0) {
            newCost = item.valorUnitario;
          }
          // Caso contrário, não atualiza o "AverageCost" pois ele preserva o preço do primeiro lote (até que ele se esgote, cuja lógica ocorrerá no consumo).
        }

        await tx.stockMovement.create({
          data: {
            organizationId,
            materialId: material.id,
            type: 'ENTRY',
            quantity: new Prisma.Decimal(item.quantidade),
            unitCost: new Prisma.Decimal(item.valorUnitario),
            totalCost: new Prisma.Decimal(item.valorTotal),
            notes: `NF-e Chave: ${payload.chaveAcesso}`,
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

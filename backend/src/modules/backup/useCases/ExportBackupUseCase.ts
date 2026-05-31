import { PrismaClient } from '@prisma/client';
import { BackupModule } from '../backup.types';

export class ExportBackupUseCase {
  private readonly CHUNK_SIZE = 1000;

  constructor(private prisma: PrismaClient) {}

  private readonly moduleMap: Record<BackupModule, string[]> = {
    config: ['organization', 'organizationSettings', 'role', 'configurationTemplate', 'automationRule', 'notifications'],
    profiles: ['profile', 'user'],
    materials: ['materialType', 'spedAccountMapping', 'material', 'insumoFornecedor', 'materialSupplier', 'inventoryItem', 'inventoryAlert', 'inventoryMovement', 'stockMovement', 'productionMaterial', 'materialReceipt', 'materialReceiptItem'],
    products: ['finish', 'standardSize', 'pricingRule', 'product', 'productStandardSize', 'productComponent', 'productConfiguration', 'configurationOption', 'optionIncompatibility', 'fichaTecnicaInsumo', 'productOperation'],
    production: ['processStatus', 'machine', 'productionQueue', 'productionOperation', 'productionWaste', 'productionOrder'],
    sales: ['budget', 'budgetItem', 'order', 'orderStatusHistory', 'pendingChanges', 'orderItem', 'orderItemConfiguration', 'delivery', 'deliveryItem'],
    finance: ['account', 'chartOfAccount', 'category', 'paymentMethod', 'transaction', 'accountPayable', 'accountReceivable'],
    audit: ['auditLog'],
  };

  /**
   * Gera um JSON para um módulo específico como AsyncGenerator para streaming
   */
  async *generateModuleJSON(organizationId: string, module: BackupModule) {
    const tables = this.moduleMap[module];
    if (!tables) {
       yield '{}';
       return;
    }

    yield '{';

    for (let j = 0; j < tables.length; j++) {
      const table = tables[j];
      yield `"${table}":[`;

      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        // Lógica de filtro específica herdada da versão anterior
        let where: any = { organizationId };
        
        switch (table) {
          case 'organization':
            where = { id: organizationId };
            break;
          case 'organizationSettings':
            where = { organizationId };
            break;
          case 'insumoFornecedor':
          case 'materialSupplier':
          case 'inventoryItem':
            where = { material: { organizationId } };
            break;
          case 'productComponent':
          case 'productConfiguration':
          case 'productStandardSize':
          case 'productOperation':
            where = { product: { organizationId } };
            break;
          case 'configurationOption':
            where = { configuration: { product: { organizationId } } };
            break;
          case 'optionIncompatibility':
            where = { optionA: { configuration: { product: { organizationId } } } };
            break;
          case 'fichaTecnicaInsumo':
            where = { organizationId };
            break;
          case 'orderItem':
          case 'orderStatusHistory':
          case 'pendingChanges':
            where = { order: { organizationId } };
            break;
          case 'orderItemConfiguration':
            where = { orderItem: { order: { organizationId } } };
            break;
          case 'budgetItem':
            where = { budget: { organizationId } };
            break;
          case 'deliveryItem':
            where = { delivery: { organizationId } };
            break;
          case 'delivery':
            where = { organizationId };
            break;
          case 'productionOperation':
            where = { productionQueue: { organizationId } };
            break;
          case 'productionWaste':
            where = { order: { organizationId } };
            break;
          case 'stockMovement':
            where = { organizationId };
            break;
          case 'materialReceipt':
            where = { organizationId };
            break;
          case 'materialReceiptItem':
            where = { receipt: { organizationId } };
            break;
        }

        const records = await (this.prisma as any)[table].findMany({
          where,
          take: this.CHUNK_SIZE,
          skip: skip,
          orderBy: { id: 'asc' }
        });

        if (records.length > 0) {
          const jsonChunk = records.map((r: any) => JSON.stringify(r)).join(',');
          yield jsonChunk;
          
          skip += this.CHUNK_SIZE;
          if (records.length === this.CHUNK_SIZE) {
            yield ',';
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      yield j === tables.length - 1 ? ']' : '],';
    }

    yield '}';
  }
}

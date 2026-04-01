import { PrismaClient } from '@prisma/client';
import { BackupModule } from '../backup.types';

export class ExportBackupUseCase {
  private readonly CHUNK_SIZE = 1000;

  constructor(private prisma: PrismaClient) {}

  // Mapeamento de tabelas por módulo (Nomes Reais do Prisma Schema)
  private readonly moduleMap: Record<BackupModule, string[]> = {
    config: ['organization', 'organizationSettings', 'automationRule'],
    profiles: ['profile', 'user'],
    materials: ['materialType', 'material', 'insumoFornecedor', 'materialSupplier', 'inventoryItem', 'inventoryMovement'],
    products: ['pricingRule', 'product', 'productComponent', 'productConfiguration', 'configurationOption', 'fichaTecnicaInsumo'],
    production: ['processStatus', 'machine', 'productionQueue', 'productionOperation'],
    sales: ['budget', 'budgetItem', 'order', 'orderItem', 'delivery', 'deliveryItem'],
    finance: ['account', 'chartOfAccount', 'category', 'paymentMethod', 'transaction', 'accountPayable', 'accountReceivable'],
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
          case 'insumoFornecedor':
          case 'materialSupplier':
          case 'inventoryItem':
            where = { material: { organizationId } };
            break;
          case 'productComponent':
          case 'productConfiguration':
            where = { product: { organizationId } };
            break;
          case 'configurationOption':
            where = { configuration: { product: { organizationId } } };
            break;
          case 'orderItem':
            where = { order: { organizationId } };
            break;
          case 'budgetItem':
            where = { budget: { organizationId } };
            break;
          case 'deliveryItem':
            where = { delivery: { organizationId } };
            break;
          case 'productionOperation':
            where = { productionQueue: { organizationId } };
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

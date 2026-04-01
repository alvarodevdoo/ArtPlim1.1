import { PrismaClient } from '@prisma/client';
import { BackupModule, ImportResult } from '../backup.types';

export class ImportBackupUseCase {
  private readonly executionOrder: BackupModule[] = [
    'config', 'profiles', 'materials', 'products', 'production', 'sales', 'finance'
  ];

  constructor(private prisma: PrismaClient) {}

  async execute(organizationId: string, userId: string, payload: any): Promise<ImportResult[]> {
    const results: ImportResult[] = [];

    // Usando transação para garantir que cada módulo seja atômico
    return await this.prisma.$transaction(async (tx) => {
      for (const moduleName of this.executionOrder) {
        const moduleData = payload.payload?.[moduleName];
        if (!moduleData) continue;

        let successCount = 0;
        let errorCount = 0;

        for (const [tableName, records] of Object.entries(moduleData)) {
          const tableRecords = records as any[];
          
          for (const record of tableRecords) {
            try {
              const { id, createdAt, updatedAt, ...data } = record;
              
              // Forçamos o isolamento por organizationId
              const where = this.getUniqueWhereClause(tableName, record, organizationId);
              
              await (tx as any)[tableName].upsert({
                where,
                update: { ...data, organizationId, updatedAt: new Date() },
                create: { ...record, organizationId },
              });
              
              successCount++;
            } catch (err: any) {
              console.error(`Erro ao importar ${tableName}:`, err.message);
              errorCount++;
            }
          }
        }

        results.push({ module: moduleName, successCount, errorCount });
      }

      // Registro de Auditoria Final
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'RESTORE_BACKUP',
          tableName: 'Backup',
          recordId: 'Restore',
          newValues: results as any,
          ipAddress: 'System'
        }
      });

      return results;
    });
  }

  private getUniqueWhereClause(tableName: string, data: any, organizationId: string): any {
    // Mapeamento de chaves únicas baseado no schema.prisma real
    const mappers: Record<string, () => any> = {
      organization: () => ({ id: organizationId }),
      organizationSettings: () => ({ organizationId }),
      profile: () => {
        if (data.document) return { organizationId_document: { organizationId, document: data.document } };
        return { organizationId_name: { organizationId, name: data.name } };
      },
      material: () => ({ organizationId_name: { organizationId, name: data.name } }),
      product: () => ({ organizationId_name: { organizationId, name: data.name } }),
      pricingRule: () => ({ organizationId_name: { organizationId, name: data.name } }),
      order: () => ({ organizationId_orderNumber: { organizationId, orderNumber: data.orderNumber } }),
      budget: () => ({ organizationId_budgetNumber: { organizationId, budgetNumber: data.budgetNumber } }),
      chartOfAccount: () => ({ organizationId_code: { organizationId, code: data.code } }),
      account: () => ({ organizationId_name: { organizationId, name: data.name } }),
      finish: () => ({ organizationId_name: { organizationId, name: data.name } }),
      automationRule: () => ({ organizationId_name: { organizationId, name: data.name } }),
      materialType: () => ({ id: data.id }), // MaterialType não possui chave única composta no schema
    };

    const mapper = mappers[tableName];
    return mapper ? mapper() : { id: data.id };
  }
}

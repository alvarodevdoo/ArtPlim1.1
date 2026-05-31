import { PrismaClient, Prisma } from '@prisma/client';
import { BackupModule, ImportResult } from '../backup.types';

interface ModelMeta {
  hasUpdatedAt: boolean;
  hasOrgId: boolean;
  // Mapeia FK scalar (ex: "parentId") -> { relationName, required } da relação correspondente.
  fkToRelation: Map<string, { relationField: string; required: boolean }>;
  // Relações "to-one" (objeto, não-lista) que carregam FK: usadas para escopar
  // tabelas-filho (sem organizationId) por organização no modo mirror.
  toOneRelations: { relationField: string; targetTable: string }[];
}

interface PendingRecord {
  tableName: string;
  module: string;
  record: any;
  lastError?: string;
}

export class ImportBackupUseCase {
  /**
   * Ordem global de importação respeitando dependências principais.
   * Tabelas-pai vêm antes das tabelas-filhas.
   */
  private readonly globalExecutionOrder: { tableName: string, module: string }[] = [
    // 1. Organização base
    { tableName: 'organization', module: 'config' },
    { tableName: 'organizationSettings', module: 'config' },
    { tableName: 'role', module: 'config' },
    
    // 2. Perfis e Usuários
    { tableName: 'profile', module: 'profiles' },
    { tableName: 'user', module: 'profiles' },
    
    // 3. Financeiro base (necessário antes de materiais/produtos que referenciam contas)
    { tableName: 'account', module: 'finance' },
    { tableName: 'chartOfAccount', module: 'finance' },
    { tableName: 'category', module: 'finance' },
    { tableName: 'paymentMethod', module: 'finance' },
    
    // 4. Config extras (podem referenciar categorias)
    { tableName: 'configurationTemplate', module: 'config' },
    { tableName: 'automationRule', module: 'config' },
    { tableName: 'notifications', module: 'config' },
    
    // 5. Materiais
    { tableName: 'materialType', module: 'materials' },
    { tableName: 'spedAccountMapping', module: 'materials' },
    { tableName: 'material', module: 'materials' },
    { tableName: 'insumoFornecedor', module: 'materials' },
    { tableName: 'materialSupplier', module: 'materials' },
    { tableName: 'inventoryItem', module: 'materials' },
    { tableName: 'inventoryAlert', module: 'materials' },
    { tableName: 'stockMovement', module: 'materials' },
    { tableName: 'productionMaterial', module: 'materials' },
    
    // 6. Produtos
    { tableName: 'finish', module: 'products' },
    { tableName: 'standardSize', module: 'products' },
    { tableName: 'pricingRule', module: 'products' },
    { tableName: 'product', module: 'products' },
    { tableName: 'productStandardSize', module: 'products' },
    { tableName: 'productComponent', module: 'products' },
    { tableName: 'productConfiguration', module: 'products' },
    { tableName: 'configurationOption', module: 'products' },
    { tableName: 'optionIncompatibility', module: 'products' },
    { tableName: 'fichaTecnicaInsumo', module: 'products' },
    { tableName: 'productOperation', module: 'products' },
    
    // 7. Produção (base)
    { tableName: 'processStatus', module: 'production' },
    { tableName: 'machine', module: 'production' },
    
    // 8. Vendas
    { tableName: 'budget', module: 'sales' },
    { tableName: 'budgetItem', module: 'sales' },
    { tableName: 'order', module: 'sales' },
    { tableName: 'orderStatusHistory', module: 'sales' },
    { tableName: 'pendingChanges', module: 'sales' },
    { tableName: 'orderItem', module: 'sales' },
    { tableName: 'orderItemConfiguration', module: 'sales' },
    { tableName: 'delivery', module: 'sales' },
    { tableName: 'deliveryItem', module: 'sales' },
    
    // 9. Produção (dependentes de orders)
    { tableName: 'productionQueue', module: 'production' },
    { tableName: 'productionOperation', module: 'production' },
    { tableName: 'productionWaste', module: 'production' },
    { tableName: 'productionOrder', module: 'production' },
    { tableName: 'inventoryMovement', module: 'materials' },
    
    // 10. Financeiro (transações dependem de orders, profiles, etc.)
    { tableName: 'accountPayable', module: 'finance' },
    { tableName: 'accountReceivable', module: 'finance' },
    { tableName: 'transaction', module: 'finance' },
    { tableName: 'materialReceipt', module: 'materials' },
    { tableName: 'materialReceiptItem', module: 'materials' },
    
    // 11. Auditoria (por último)
    { tableName: 'auditLog', module: 'audit' }
  ];

  private readonly modules: string[] = [
    'config', 'profiles', 'materials', 'products', 'production', 'sales', 'finance', 'audit'
  ];

  /** Tabelas que não possuem campo updatedAt */
  private readonly noUpdatedAt = new Set([
    'auditLog', 'orderStatusHistory', 'inventoryMovement',
    'stockMovement', 'notifications', 'spedAccountMapping',
    'optionIncompatibility', 'productionWaste', 'deliveryItem',
    'materialReceiptItem', 'orderItemConfiguration', 'productStandardSize',
    'productOperation'
  ]);

  /** Tabelas que não possuem organizationId direto */
  private readonly noOrgId = new Set([
    'organization', 'organizationSettings', 'inventoryItem',
    'insumoFornecedor', 'materialSupplier', 'productComponent',
    'productConfiguration', 'configurationOption', 'optionIncompatibility',
    'productStandardSize', 'productOperation',
    'orderItem', 'orderItemConfiguration', 'orderStatusHistory',
    'budgetItem', 'deliveryItem', 'productionOperation',
    'materialReceiptItem', 'fichaTecnicaInsumo'
  ]);

  private modelMetaCache = new Map<string, ModelMeta | null>();

  constructor(private prisma: PrismaClient) {}

  /**
   * Lê o DMMF do Prisma para descobrir, por tabela:
   *  - se o model tem campo `updatedAt` (evita "Unknown argument updatedAt");
   *  - o mapa FK scalar -> relação, para converter `parentId`/`chartOfAccountId`
   *    em escrita aninhada `connect`/`disconnect` no update (Prisma v7 não aceita
   *    FK scalar no input de update, só no de create).
   */
  private getModelMeta(tableName: string): ModelMeta | null {
    if (this.modelMetaCache.has(tableName)) {
      return this.modelMetaCache.get(tableName)!;
    }

    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1) === tableName
    );

    if (!model) {
      this.modelMetaCache.set(tableName, null);
      return null;
    }

    const fkToRelation = new Map<string, { relationField: string; required: boolean }>();
    const toOneRelations: { relationField: string; targetTable: string }[] = [];
    let hasUpdatedAt = false;
    let hasOrgId = false;

    // O DMMF de runtime do Prisma 7 não expõe mais `relationFromFields`/`isList`
    // nos campos de relação (apenas name/type). Descobrimos o FK scalar por
    // convenção: a relação "x" é dona da FK se o model tiver o scalar "xId".
    const scalarNames = new Set(
      model.fields.filter((f) => f.kind === 'scalar').map((f) => f.name)
    );
    hasUpdatedAt = scalarNames.has('updatedAt');
    hasOrgId = scalarNames.has('organizationId');

    for (const field of model.fields) {
      if (field.kind !== 'object') continue;
      const fk = `${field.name}Id`;
      if (!scalarNames.has(fk)) continue; // não é o lado dono / não é to-one local

      fkToRelation.set(fk, { relationField: field.name, required: false });
      toOneRelations.push({
        relationField: field.name,
        targetTable: field.type.charAt(0).toLowerCase() + field.type.slice(1),
      });
    }

    const meta: ModelMeta = { hasUpdatedAt, hasOrgId, fkToRelation, toOneRelations };
    this.modelMetaCache.set(tableName, meta);
    return meta;
  }

  /**
   * Converte FKs scalar em escrita aninhada de relação para o input de UPDATE.
   * Ex.: { parentId: "x" } -> { parent: { connect: { id: "x" } } }
   *      { parentId: null } -> { parent: { disconnect: true } }  (se opcional)
   */
  private toRelationalUpdateData(tableName: string, data: any): any {
    const meta = this.getModelMeta(tableName);
    if (!meta) return data;

    const result: any = { ...data };
    for (const [fk, rel] of meta.fkToRelation) {
      if (!(fk in result)) continue;
      const value = result[fk];
      delete result[fk];

      if (value === null || value === undefined) {
        // Relação obrigatória não pode ser desconectada; deixa como está (não altera).
        if (!rel.required) result[rel.relationField] = { disconnect: true };
      } else {
        result[rel.relationField] = { connect: { id: value } };
      }
    }
    return result;
  }

  /**
   * Monta um filtro `where` que escopa a tabela à organização.
   * - Tabelas com coluna organizationId: { organizationId }.
   * - Tabelas-filho sem organizationId: navega por uma relação to-one até
   *   alcançar uma tabela que tenha organizationId (ex: orderItem -> { order: { organizationId } }).
   * Retorna null se não for possível escopar (a limpeza dessa tabela é então pulada).
   */
  private buildOrgScopedWhere(
    tableName: string,
    organizationId: string,
    depth = 0,
    seen: Set<string> = new Set()
  ): any | null {
    if (depth > 6 || seen.has(tableName)) return null;
    const meta = this.getModelMeta(tableName);
    if (!meta) return null;
    if (meta.hasOrgId) return { organizationId };

    const nextSeen = new Set(seen).add(tableName);
    for (const rel of meta.toOneRelations) {
      const sub = this.buildOrgScopedWhere(rel.targetTable, organizationId, depth + 1, nextSeen);
      if (sub) return { [rel.relationField]: sub };
    }
    return null;
  }

  /**
   * Modo mirror: apaga, na org de destino, os dados das tabelas dos módulos
   * selecionados, em ordem reversa de FK (filhos antes dos pais). Cada delete é
   * isolado por savepoint — se uma FK de um módulo NÃO selecionado bloquear,
   * o delete é pulado com aviso em vez de abortar a transação inteira.
   * A própria tabela `organization` nunca é apagada (é o tenant de destino).
   */
  private async wipeModules(tx: any, selectedModules: string[], organizationId: string) {
    const selected = new Set(selectedModules);
    // Nunca apagar a própria organização (tenant de destino) nem as tabelas de
    // identidade/auth: estas têm chave única (email/documento), então o upsert não
    // duplica, e apagá-las poderia trancar o operador atual para fora do sistema.
    const neverWipe = new Set(['organization', 'user', 'profile', 'role']);
    const wipeList = [...this.globalExecutionOrder]
      .reverse()
      .filter((i) => selected.has(i.module) && !neverWipe.has(i.tableName));

    let counter = 0;
    for (const item of wipeList) {
      if (!tx[item.tableName]) continue;
      const where = this.buildOrgScopedWhere(item.tableName, organizationId);
      if (!where) {
        console.warn(`[Mirror] Tabela "${item.tableName}" não pôde ser escopada por org — limpeza pulada.`);
        continue;
      }

      const sp = `sp_wipe_${counter++}`;
      await tx.$executeRawUnsafe(`SAVEPOINT "${sp}"`);
      try {
        const result = await tx[item.tableName].deleteMany({ where });
        await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${sp}"`);
        if (result.count > 0) {
          console.log(`[Mirror] ${item.tableName}: ${result.count} registro(s) removido(s).`);
        }
      } catch (err: any) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${sp}"`);
        console.warn(`[Mirror] Não foi possível limpar "${item.tableName}": ${err.message}`);
      }
    }
  }

  async execute(
    organizationId: string,
    userId: string,
    payload: any,
    options: { mirror?: boolean } = {}
  ): Promise<ImportResult[]> {
    const resultsMap: Record<string, ImportResult> = {};
    for (const mod of this.modules) {
      resultsMap[mod] = { module: mod, successCount: 0, errorCount: 0, errors: [] };
    }

    const selectedModules = Object.keys(payload?.payload ?? {});

    return await this.prisma.$transaction(async (tx) => {
      // ═══════════════════════════════════════════════════════
      // FASE 0 (mirror): limpa os dados dos módulos selecionados
      // ═══════════════════════════════════════════════════════
      if (options.mirror) {
        console.log(`[Backup Restore] Modo mirror: limpando módulos [${selectedModules.join(', ')}]`);
        await this.wipeModules(tx, selectedModules, organizationId);
      }

      // ═══════════════════════════════════════════════════════
      // FASE 1: Coleta todos os registros na ordem correta
      // ═══════════════════════════════════════════════════════
      const allRecords: PendingRecord[] = [];

      for (const item of this.globalExecutionOrder) {
        const tableRecords = payload.payload?.[item.module]?.[item.tableName];
        if (!tableRecords || !Array.isArray(tableRecords)) continue;

        for (const record of tableRecords) {
          allRecords.push({
            tableName: item.tableName,
            module: item.module,
            record: { ...record }, // clone para não mutar o original
          });
        }
      }

      console.log(`[Backup Restore] Total de registros a importar: ${allRecords.length}`);

      // ═══════════════════════════════════════════════════════
      // FASE 2: Multi-passo (até 3 tentativas)
      // Cada passo tenta importar os que falharam no anterior,
      // pois agora suas dependências podem já existir.
      // ═══════════════════════════════════════════════════════
      let pending = allRecords;
      const MAX_PASSES = 3;
      let savepointCounter = 0;

      for (let pass = 1; pass <= MAX_PASSES; pass++) {
        const stillFailing: PendingRecord[] = [];
        console.log(`[Backup Restore] Passo ${pass}/${MAX_PASSES}: ${pending.length} registros pendentes`);

        for (const item of pending) {
          // SAVEPOINT por registro: no Postgres, qualquer erro dentro da transação
          // a aborta inteira ("current transaction is aborted"). O savepoint isola
          // a falha de um único registro, mantendo a transação viva para os demais
          // e permitindo que o retry multi-passo resolva dependências de FK.
          const sp = `sp_restore_${savepointCounter++}`;
          await tx.$executeRawUnsafe(`SAVEPOINT "${sp}"`);
          try {
            await this.importRecord(tx, item.tableName, item.record, organizationId);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${sp}"`);
            resultsMap[item.module].successCount++;
          } catch (err: any) {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${sp}"`);
            item.lastError = err.message;
            stillFailing.push(item);
          }
        }

        if (stillFailing.length === 0) {
          console.log(`[Backup Restore] Passo ${pass}: Todos os registros importados com sucesso!`);
          break;
        }

        // Último passo: registra os erros definitivos
        if (pass === MAX_PASSES) {
          for (const item of stillFailing) {
            console.error(`[Backup Restore] FALHA DEFINITIVA [${item.tableName}]:`, item.lastError);
            resultsMap[item.module].errorCount++;
            if (resultsMap[item.module].errors!.length < 10) {
              resultsMap[item.module].errors!.push(`[${item.tableName}] ${item.lastError}`);
            }
          }
        }

        pending = stillFailing;
      }

      // ═══════════════════════════════════════════════════════
      // FASE 3: Registro de auditoria
      // ═══════════════════════════════════════════════════════
      const finalResults = Object.values(resultsMap);
      
      try {
        await (tx as any).auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'RESTORE_BACKUP',
            tableName: 'Backup',
            recordId: 'Restore',
            newValues: finalResults as any,
            ipAddress: 'System'
          }
        });
      } catch (auditErr: any) {
        console.error('[Backup Restore] Erro ao criar log de auditoria:', auditErr.message);
      }

      return finalResults;
    }, {
      maxWait: 30000,    // 30 seconds
      timeout: 600000    // 10 minutes
    });
  }

  /**
   * Importa um único registro: findUnique → update ou create.
   */
  private async importRecord(
    tx: any,
    tableName: string,
    record: any,
    organizationId: string
  ) {
    const { id, createdAt, updatedAt, organizationId: _staleOrgId, ...data } = record;

    // O backup pode vir de outra organização/ambiente (ex: produção → dev).
    // O organizationId original (de produção) precisa ser descartado e substituído
    // pelo da org de destino; caso contrário viola FK/unique em Organization.
    const hasOrgIdColumn = !this.noOrgId.has(tableName) || tableName === 'organizationSettings';

    // Compatibilidade: ignorar roleId em backups antigos que não exportavam Roles
    if (tableName === 'user' && data.roleId) {
      try {
        const roleExists = await tx.role.findUnique({ where: { id: data.roleId } });
        if (!roleExists) {
          data.roleId = null;
          record.roleId = null;
        }
      } catch {
        data.roleId = null;
        record.roleId = null;
      }
    }

    const where = this.getUniqueWhereClause(tableName, record, organizationId);

    // Verifica se o model do Prisma existe
    if (!(tx as any)[tableName]) {
      throw new Error(`Tabela "${tableName}" não encontrada no Prisma Client.`);
    }

    const existingRecord = await (tx as any)[tableName].findUnique({ where });

    if (existingRecord) {
      // UPDATE: não reescreve organizationId. O `where` já localizou a linha da org
      // de destino; além disso, relações 1-1 (ex: OrganizationSettings) rejeitam o
      // scalar `organizationId` no data do update ("Unknown argument organizationId").
      const meta = this.getModelMeta(tableName);
      const updateData = this.toRelationalUpdateData(tableName, data);
      // updatedAt só existe em parte dos models; o DMMF é a fonte de verdade.
      if (meta ? meta.hasUpdatedAt : !this.noUpdatedAt.has(tableName)) {
        updateData.updatedAt = new Date();
      }

      await (tx as any)[tableName].update({ where, data: updateData });
    } else {
      // CREATE: preserva id/createdAt originais, mas normaliza o organizationId
      const createData: any = { ...data, id };
      if (createdAt !== undefined) createData.createdAt = createdAt;
      if (tableName === 'organization') {
        createData.id = organizationId;
      } else if (hasOrgIdColumn) {
        createData.organizationId = organizationId;
      }

      await (tx as any)[tableName].create({ data: createData });
    }
  }

  private getUniqueWhereClause(tableName: string, data: any, organizationId: string): any {
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
      standardSize: () => ({ organizationId_name_type: { organizationId, name: data.name, type: data.type } }),
      productionMaterial: () => ({ organizationId_name_type: { organizationId, name: data.name, type: data.type } }),
      user: () => ({ organizationId_email: { organizationId, email: data.email } }),
      insumoFornecedor: () => ({ insumoId_fornecedorId: { insumoId: data.insumoId, fornecedorId: data.fornecedorId } }),
    };

    const mapper = mappers[tableName];
    return mapper ? mapper() : { id: data.id };
  }
}

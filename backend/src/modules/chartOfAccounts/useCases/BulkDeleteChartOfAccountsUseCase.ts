import { PrismaClient } from '@prisma/client';

interface BulkDeleteResult {
  deleted: number;
  softDeleted: number;
  blocked: Array<{
    id: string;
    code: string | null;
    name: string;
    reason: string;
    materials?: Array<{ id: string; name: string }>;
  }>;
}

export class BulkDeleteChartOfAccountsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(ids: string[], organizationId: string): Promise<BulkDeleteResult> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Nenhuma conta selecionada.');
    }

    const allAccounts = await (this.prisma as any).chartOfAccount.findMany({
      where: { organizationId },
      select: { id: true, parentId: true, code: true, name: true }
    });

    const childrenByParent = new Map<string, string[]>();
    for (const acc of allAccounts) {
      if (acc.parentId) {
        const list = childrenByParent.get(acc.parentId) || [];
        list.push(acc.id);
        childrenByParent.set(acc.parentId, list);
      }
    }

    const closure = new Set<string>();
    const stack = [...ids];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (closure.has(current)) continue;
      closure.add(current);
      const children = childrenByParent.get(current) || [];
      for (const child of children) stack.push(child);
    }

    const accountsToProcess = allAccounts
      .filter((a: any) => closure.has(a.id))
      .sort((a: any, b: any) => {
        const da = (a.code || '').split('.').length;
        const db = (b.code || '').split('.').length;
        if (da !== db) return db - da;
        return (b.code || '').localeCompare(a.code || '', undefined, { numeric: true });
      });

    const result: BulkDeleteResult = { deleted: 0, softDeleted: 0, blocked: [] };

    for (const acc of accountsToProcess) {
      const full = await (this.prisma as any).chartOfAccount.findUnique({
        where: { id: acc.id },
        include: {
          expenseMaterials: { select: { id: true, name: true } },
          inventoryMaterials: { select: { id: true, name: true } },
          categories: { select: { id: true } },
          categoryExpenseAccounts: { select: { id: true } },
          categoryInventoryAccounts: { select: { id: true } },
          revenueProducts: { select: { id: true } },
          paymentMethodsFee: { select: { id: true } },
        }
      });

      if (!full || full.organizationId !== organizationId) continue;

      const materials = [
        ...full.expenseMaterials,
        ...full.inventoryMaterials,
      ].filter((v: any, i: number, a: any[]) => a.findIndex(t => t.id === v.id) === i);

      const hasOtherLinks =
        full.categories.length > 0 ||
        full.categoryExpenseAccounts.length > 0 ||
        full.categoryInventoryAccounts.length > 0 ||
        full.revenueProducts.length > 0 ||
        full.paymentMethodsFee.length > 0;

      if (materials.length > 0 || hasOtherLinks) {
        await (this.prisma as any).chartOfAccount.update({
          where: { id: acc.id },
          data: { active: false }
        });
        result.softDeleted += 1;
        if (materials.length > 0) {
          result.blocked.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            reason: 'Conta possui materiais vinculados — desativada (soft delete). Migre os materiais para excluir definitivamente.',
            materials: materials.map((m: any) => ({ id: m.id, name: m.name })),
          });
        }
      } else {
        await (this.prisma as any).chartOfAccount.delete({ where: { id: acc.id } });
        result.deleted += 1;
      }
    }

    return result;
  }
}

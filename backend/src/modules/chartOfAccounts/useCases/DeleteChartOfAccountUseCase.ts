import { PrismaClient } from '@prisma/client';

export class DeleteChartOfAccountUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(id: string, organizationId: string, replacementAccountId?: string) {
    // 1. Check if account exists and belongs to the organization
    const account = await (this.prisma as any).chartOfAccount.findUnique({
      where: { id },
      include: {
        children: true, // we can check if it has sub-accounts
        expenseMaterials: true,
        inventoryMaterials: true,
      }
    });

    if (!account || account.organizationId !== organizationId) {
      throw new Error('Conta contábil não encontrada.');
    }

    // 2. Prevent deletion if it has children
    if (account.children.length > 0) {
      throw new Error('Não é possível excluir uma conta que possui subcontas. Exclua as subcontas primeiro.');
    }

    const hasDependencies = account.expenseMaterials.length > 0 || account.inventoryMaterials.length > 0;

    // 3. Prevent deletion if there are linked materials and no replacement is provided
    if (!replacementAccountId && hasDependencies) {
      const error: any = new Error('Conta possui dependências materiais e requer migração.');
      error.code = 'HAS_DEPENDENCIES';
      error.dependencies = {
        materials: [...account.expenseMaterials, ...account.inventoryMaterials].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i)
      };
      throw error;
    }

    // 4. If replacement is requested, migrate all materials
    if (replacementAccountId) {
      const repAccount = await (this.prisma as any).chartOfAccount.findUnique({ where: { id: replacementAccountId } });
      if (!repAccount || repAccount.organizationId !== organizationId) {
        throw new Error('Conta de substituição inválida.');
      }

      // Migrate expense materials
      if (account.expenseMaterials.length > 0) {
        await (this.prisma as any).material.updateMany({
          where: { expenseAccountId: id },
          data: { expenseAccountId: replacementAccountId }
        });
      }

      // Migrate inventory materials
      if (account.inventoryMaterials.length > 0) {
        await (this.prisma as any).material.updateMany({
          where: { inventoryAccountId: id },
          data: { inventoryAccountId: replacementAccountId }
        });
      }
    }

    // 5. Choose between Hard Delete (Clean) and Soft Delete (Historical Preservation)
    if (hasDependencies) {
      await (this.prisma as any).chartOfAccount.update({
        where: { id },
        data: { active: false }
      });
    } else {
      await (this.prisma as any).chartOfAccount.delete({
        where: { id }
      });
    }

    return true;
  }
}

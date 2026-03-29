import { PrismaClient } from '@prisma/client';

export class ListChartOfAccountsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(organizationId: string, includeInactive: boolean = false) {
    const whereClause: any = { organizationId };
    if (!includeInactive) {
      whereClause.active = true;
    }

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: whereClause,
      orderBy: { code: 'asc' }
    });

    const accountMap = new Map<string, any>();
    
    // Convert all to nodes with empty children array
    accounts.forEach(acc => accountMap.set(acc.id, { ...acc, children: [] }));

    const tree: any[] = [];

    accountMap.forEach(acc => {
      if (acc.parentId) {
        const parent = accountMap.get(acc.parentId);
        if (parent) {
          parent.children.push(acc);
        } else {
          // If parent is unexpectedly missing, add to root
          tree.push(acc);
        }
      } else {
        tree.push(acc);
      }
    });

    return tree;
  }
}

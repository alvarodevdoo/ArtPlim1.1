import { PrismaClient, ChartAccountType, AccountNature } from '@prisma/client';

export type UpdateChartOfAccountInput = {
  id: string;
  organizationId: string;
  name?: string;
  code?: string;
  description?: string;
  nature?: AccountNature;
  type?: ChartAccountType;
  parentId?: string | null;
  active?: boolean;
  systemRole?: any;
};

export class UpdateChartOfAccountUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(input: UpdateChartOfAccountInput) {
    const account = await this.prisma.chartOfAccount.findUnique({
      where: { id: input.id }
    }) as any;

    if (!account || account.organizationId !== input.organizationId) {
      throw new Error('Conta não encontrada.');
    }

    // Se mudou o pai, herda a natureza (opcional, dependendo da regra de negócio)
    let finalNature = input.nature || account.nature;
    if (input.parentId && input.parentId !== account.parentId) {
      const parent = await this.prisma.chartOfAccount.findUnique({
        where: { id: input.parentId }
      }) as any;
      if (parent) {
        finalNature = parent.nature;
      }
    }

    const oldCode = account.code;
    const newCode = input.code;
    const codeChanged = newCode && oldCode && newCode !== oldCode;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.chartOfAccount.update({
          where: { id: input.id },
          data: {
            name: input.name ?? undefined,
            code: newCode ?? undefined,
            description: input.description ?? undefined,
            nature: finalNature,
            type: input.type ?? undefined,
            parentId: input.parentId,
            systemRole: (input.type || account.type) === ChartAccountType.SYNTHETIC ? 'GENERAL' : (input.systemRole ?? undefined),
            active: input.active ?? undefined
          } as any
        });

        // Se o código mudou, atualiza recursivamente todos os descendentes que usavam o prefixo antigo
        if (codeChanged) {
          const allDescendants = await tx.chartOfAccount.findMany({
            where: { 
              organizationId: input.organizationId,
              code: { startsWith: `${oldCode}.` }
            }
          });

          for (const descendant of allDescendants) {
            if (descendant.code && descendant.code.startsWith(`${oldCode}.`)) {
              // Substituição atômica baseada apenas no prefixo inicial
              const updatedDescendantCode = newCode + descendant.code.substring(oldCode.length);
              
              await tx.chartOfAccount.update({
                where: { id: descendant.id },
                data: { code: updatedDescendantCode }
              });
            }
          }
        }

        return updated;
      });

      return result;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error(`Este código de conta "${newCode}" já está sendo utilizado nesta organização.`);
      }
      throw error;
    }
  }
}

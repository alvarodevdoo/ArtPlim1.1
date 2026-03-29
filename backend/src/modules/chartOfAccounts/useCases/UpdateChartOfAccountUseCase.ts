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

    return await this.prisma.chartOfAccount.update({
      where: { id: input.id },
      data: {
        name: input.name ?? undefined,
        code: input.code ?? undefined,
        description: input.description ?? undefined,
        nature: finalNature,
        type: input.type ?? undefined,
        parentId: input.parentId,
        active: input.active ?? undefined
      }
    });
  }
}

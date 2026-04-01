import { PrismaClient, ChartAccountType, AccountNature } from '@prisma/client';

export type CreateChartOfAccountInput = {
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  nature: AccountNature;
  type: ChartAccountType;
  parentId?: string;
  systemRole?: any;
};

export class CreateChartOfAccountUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(input: CreateChartOfAccountInput) {
    let finalNature = input.nature;

    if (input.parentId) {
      const parent = await this.prisma.chartOfAccount.findUnique({
        where: { id: input.parentId }
      }) as any;
      if (parent) {
        if (parent.organizationId !== input.organizationId) {
          throw new Error('Conta pai não encontrada para esta organização.');
        }
        finalNature = parent.nature; // Herda a natureza do pai
      }
    }

    // DUPLICATE CHECK
    if (input.code) {
      const existing = await this.prisma.chartOfAccount.findUnique({
        where: { organizationId_code: { organizationId: input.organizationId, code: input.code } }
      }) as any;
      if (existing) {
        throw new Error(`O código "${input.code}" já está cadastrado para a conta "${existing.name}". Para criar uma subcategoria, use esta conta como "Categoria Pai" no formulário.`);
      }
    }

    if (!input.code) {
      // Logic for generic auto-incrementing if no code provided
      const siblings = await this.prisma.chartOfAccount.findMany({
        where: { organizationId: input.organizationId, parentId: input.parentId }
      });
      // Basic generation
      const nextSuffix = siblings.length + 1;
      if (input.parentId) {
        const parent = await this.prisma.chartOfAccount.findUnique({ where: { id: input.parentId } });
        input.code = `${parent?.code || 'X'}.${nextSuffix}`;
      } else {
        input.code = nextSuffix.toString();
      }
    }

    try {
      return await this.prisma.chartOfAccount.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          code: input.code,
          description: input.description,
          nature: finalNature,
          type: input.type,
          parentId: input.parentId,
          systemRole: input.type === ChartAccountType.SYNTHETIC ? 'GENERAL' : (input.systemRole || 'GENERAL'),
          active: true
        } as any
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error(`Este código de conta "${input.code}" já está sendo utilizado nesta organização.`);
      }
      throw error;
    }
  }
}

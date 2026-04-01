import { PrismaClient, SpedAccountType } from '@prisma/client';

interface UpdateSpedMappingRequest {
  organizationId: string;
  materialTypeId?: string;
  spedType: string;
  mappingType: SpedAccountType;
  accountIds: string[];
}

export class UpdateSpedMappingsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute({ organizationId, materialTypeId, spedType, mappingType, accountIds }: UpdateSpedMappingRequest) {
    // 1. Limpa mapeamentos antigos para este contexto
    await this.prisma.spedAccountMapping.deleteMany({
      where: {
        organizationId,
        materialTypeId, // Agora filtra pela ID dinâmica se fornecida
        spedType,
        mappingType
      }
    });

    // 2. Cria novos mapeamentos
    if (accountIds.length > 0) {
      const data = accountIds.map(accountId => ({
        organizationId,
        materialTypeId,
        spedType,
        accountId,
        mappingType
      }));

      return this.prisma.spedAccountMapping.createMany({
        data
      });
    }

    return { count: 0 };
  }
}

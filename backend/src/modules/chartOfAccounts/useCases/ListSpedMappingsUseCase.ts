import { PrismaClient } from '@prisma/client';

export class ListSpedMappingsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(organizationId: string) {
    return this.prisma.spedAccountMapping.findMany({
      where: { organizationId },
      include: {
        chartOfAccount: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true
          }
        }
      },
      orderBy: [
        { spedType: 'asc' },
        { mappingType: 'asc' }
      ]
    });
  }
}

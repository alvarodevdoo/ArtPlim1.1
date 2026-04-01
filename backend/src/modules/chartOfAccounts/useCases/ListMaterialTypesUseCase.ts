import { PrismaClient } from '@prisma/client';

export class ListMaterialTypesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute({ organizationId }: { organizationId: string }) {
    return this.prisma.materialType.findMany({
      where: { organizationId },
      include: {
        mappings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                code: true,
                nature: true,
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
    });
  }
}

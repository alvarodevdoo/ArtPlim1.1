import { PrismaClient } from '@prisma/client';

interface CreateMaterialTypeRequest {
  organizationId: string;
  name: string;
  spedCode?: string;
}

export class CreateMaterialTypeUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute({ organizationId, name, spedCode }: CreateMaterialTypeRequest) {
    return this.prisma.materialType.create({
      data: {
        organizationId,
        name,
        spedCode: spedCode || '01',
      },
    });
  }
}

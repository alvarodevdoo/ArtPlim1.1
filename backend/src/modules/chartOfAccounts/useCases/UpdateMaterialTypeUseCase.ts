import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

interface UpdateMaterialTypeRequest {
  organizationId: string;
  id: string;
  name?: string;
  spedCode?: string;
}

export class UpdateMaterialTypeUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute({ organizationId, id, name, spedCode }: UpdateMaterialTypeRequest) {
    const materialType = await this.prisma.materialType.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!materialType) {
      throw new AppError('Tipo de insumo não encontrado.', 404);
    }

    return this.prisma.materialType.update({
      where: { id },
      data: {
        name: name || materialType.name,
        spedCode: spedCode || materialType.spedCode || '01',
      },
    });
  }
}

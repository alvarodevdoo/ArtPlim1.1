import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

interface DeleteMaterialTypeRequest {
  organizationId: string;
  id: string;
}

export class DeleteMaterialTypeUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute({ organizationId, id }: DeleteMaterialTypeRequest) {
    const materialType = await this.prisma.materialType.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { materials: true }
        }
      }
    });

    if (!materialType) {
      throw new AppError('Tipo de insumo não encontrado.', 404);
    }

    if (materialType._count.materials > 0) {
      throw new AppError('Não é possível excluir um tipo que possui insumos vinculados.', 400);
    }

    return this.prisma.materialType.delete({
      where: { id },
    });
  }
}

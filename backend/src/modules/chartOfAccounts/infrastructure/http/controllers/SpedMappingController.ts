import { FastifyRequest, FastifyReply } from 'fastify';
import { ListSpedMappingsUseCase } from '../../../useCases/ListSpedMappingsUseCase';
import { UpdateSpedMappingsUseCase } from '../../../useCases/UpdateSpedMappingsUseCase';
import { ListMaterialTypesUseCase } from '../../../useCases/ListMaterialTypesUseCase';
import { CreateMaterialTypeUseCase } from '../../../useCases/CreateMaterialTypeUseCase';
import { UpdateMaterialTypeUseCase } from '../../../useCases/UpdateMaterialTypeUseCase';
import { DeleteMaterialTypeUseCase } from '../../../useCases/DeleteMaterialTypeUseCase';
import { getTenantClient } from '../../../../../shared/infrastructure/database/tenant';
import { z } from 'zod';

const updateMappingsSchema = z.object({
  materialTypeId: z.string().optional(),
  spedType: z.string(),
  mappingType: z.enum(['INVENTORY', 'EXPENSE']),
  accountIds: z.array(z.string())
});

const createTypeSchema = z.object({
  name: z.string(),
  spedCode: z.string().optional(),
});

const updateTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  spedCode: z.string().optional(),
});

export class SpedMappingController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ListSpedMappingsUseCase(prisma as any);
      const data = await useCase.execute(organizationId);

      return reply.send({ success: true, data });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  async listTypes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ListMaterialTypesUseCase(prisma as any);
      const data = await useCase.execute({ organizationId });

      return reply.send({ success: true, data });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  async createType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const data = createTypeSchema.parse(request.body);
      const prisma = getTenantClient(organizationId);
      const useCase = new CreateMaterialTypeUseCase(prisma as any);
      
      const materialType = await useCase.execute({
        organizationId,
        ...data
      });

      return reply.status(201).send({ success: true, data: materialType });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async updateType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const data = updateTypeSchema.parse(request.body);
      const prisma = getTenantClient(organizationId);
      const useCase = new UpdateMaterialTypeUseCase(prisma as any);
      
      const materialType = await useCase.execute({
        organizationId,
        ...data
      });

      return reply.send({ success: true, data: materialType });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async deleteType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const { id } = request.params as { id: string };
      const prisma = getTenantClient(organizationId);
      const useCase = new DeleteMaterialTypeUseCase(prisma as any);
      
      await useCase.execute({ organizationId, id });

      return reply.send({ success: true, message: 'Tipo de insumo excluído com sucesso!' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const data = updateMappingsSchema.parse(request.body);

      const prisma = getTenantClient(organizationId);
      const useCase = new UpdateSpedMappingsUseCase(prisma as any);
      
      await useCase.execute({
        organizationId,
        materialTypeId: data.materialTypeId,
        spedType: data.spedType,
        mappingType: data.mappingType as any,
        accountIds: data.accountIds
      });

      return reply.send({ success: true, message: 'Vinculações atualizadas com sucesso!' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Dados inválidos', issues: error.issues });
      }
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}

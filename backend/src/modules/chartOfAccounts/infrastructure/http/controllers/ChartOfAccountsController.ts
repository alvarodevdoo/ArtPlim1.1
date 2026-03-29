import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateChartOfAccountUseCase } from '../../../useCases/CreateChartOfAccountUseCase';
import { ListChartOfAccountsUseCase } from '../../../useCases/ListChartOfAccountsUseCase';
import { UpdateChartOfAccountUseCase } from '../../../useCases/UpdateChartOfAccountUseCase';
import { DeleteChartOfAccountUseCase } from '../../../useCases/DeleteChartOfAccountUseCase';
import { SeedChartOfAccountsUseCase } from '../../../useCases/SeedChartOfAccountsUseCase';
import { getTenantClient } from '../../../../../shared/infrastructure/database/tenant';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  code: z.string().optional(),
  description: z.string().optional().nullable(),
  nature: z.string(),
  type: z.string(),
  parentId: z.string().optional(),
  parentCode: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

export class ChartOfAccountsController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const { includeInactive } = request.query as { includeInactive?: string };
      const prisma = getTenantClient(organizationId);
      const useCase = new ListChartOfAccountsUseCase(prisma as any);
      const tree = await useCase.execute(organizationId, includeInactive === 'true');

      return reply.send({ success: true, data: tree });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const data = createSchema.parse(request.body) as any;

      const prisma = getTenantClient(organizationId);
      const useCase = new CreateChartOfAccountUseCase(prisma);

      // Resolve parentCode -> parentId if sent from the seed wizard
      let resolvedParentId = data.parentId;
      if (!resolvedParentId && data.parentCode) {
        const parentAccount = await (prisma as any).chartOfAccount.findUnique({
          where: { organizationId_code: { organizationId, code: data.parentCode } }
        });
        if (parentAccount) {
          resolvedParentId = parentAccount.id;
        }
      }
      
      const newAccount = await useCase.execute({
        name: data.name,
        code: data.code,
        description: data.description ?? undefined,
        nature: data.nature,
        type: data.type,
        parentId: resolvedParentId,
        organizationId
      });

      return reply.status(201).send({ success: true, data: newAccount });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Dados inválidos', issues: error.issues });
      }
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const { id } = request.params as { id: string };
      const data = updateSchema.parse(request.body) as any;

      const prisma = getTenantClient(organizationId);
      const useCase = new UpdateChartOfAccountUseCase(prisma);
      
      const updatedAccount = await useCase.execute({
        name: data.name,
        code: data.code,
        description: data.description,
        nature: data.nature,
        type: data.type,
        parentId: data.parentId,
        id,
        organizationId
      });

      return reply.send({ success: true, data: updatedAccount });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Dados inválidos', issues: error.issues });
      }
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const { id } = request.params as { id: string };
      const { replacementAccountId } = request.query as { replacementAccountId?: string };

      const prisma = getTenantClient(organizationId);
      const useCase = new DeleteChartOfAccountUseCase(prisma as any);
      
      await useCase.execute(id, organizationId, replacementAccountId);

      return reply.send({ success: true, message: 'Conta contábil removida com sucesso!' });
    } catch (error: any) {
      if (error.code === 'HAS_DEPENDENCIES') {
        return reply.status(400).send({ 
          success: false, 
          message: error.message, 
          code: error.code, 
          dependencies: error.dependencies 
        });
      }
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async restore(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const { id } = request.params as { id: string };

      const prisma = getTenantClient(organizationId);
      await (prisma as any).chartOfAccount.update({
        where: { id },
        data: { active: true }
      });

      return reply.send({ success: true, message: 'Conta contábil restaurada com sucesso!' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  async reset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const prisma = getTenantClient(organizationId);
      
      // 1. Delete all existing (children first to avoid FKey issues? No, self-referential children)
      // Prisma handle cascades if configured, but here we can just delete all
      await (prisma as any).chartOfAccount.deleteMany({
        where: { organizationId }
      });

      // 2. Run Seed
      const useCase = new SeedChartOfAccountsUseCase();
      await useCase.execute(organizationId, prisma as any);

      return reply.send({ success: true, message: 'Plano de contas resetado com sucesso!' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message });
    }
  }
}

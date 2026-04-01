import { FastifyRequest, FastifyReply } from 'fastify';
import { getTenantClient } from '../../../../../shared/infrastructure/database/tenant';
import { ExportBackupUseCase } from '../../../useCases/ExportBackupUseCase';
import { ImportBackupUseCase } from '../../../useCases/ImportBackupUseCase';

export class BackupController {
  async export(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ExportBackupUseCase(prisma as any);

      const backup = await useCase.execute(organizationId);

      return reply.send({ success: true, data: backup });
    } catch (error: any) {
      return reply.status(500).send({ 
        success: false, 
        error: { message: error.message, statusCode: 500 } 
      });
    }
  }

  async import(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const userId = request.user!.userId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ImportBackupUseCase(prisma as any);
      
      const payload = request.body;
      const results = await useCase.execute(organizationId, userId, payload);

      return reply.send({ success: true, data: results });
    } catch (error: any) {
      console.error('Erro na restauração:', error);
      return reply.status(400).send({ 
        success: false, 
        error: { message: error.message, statusCode: 400 } 
      });
    }
  }
}

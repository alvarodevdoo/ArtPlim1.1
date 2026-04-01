import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../../shared/infrastructure/auth/middleware';
import { BackupController } from './controllers/BackupController';

export async function backupRoutes(fastify: FastifyInstance) {
  const controller = new BackupController();

  // GET /api/backup/export
  fastify.get(
    '/export',
    { preHandler: [fastify.authenticate, requirePermission(['backup.export'])] },
    controller.export.bind(controller)
  );

  // POST /api/backup/import
  fastify.post(
    '/import',
    { preHandler: [fastify.authenticate, requirePermission(['backup.import'])] },
    controller.import.bind(controller)
  );
}

import { FastifyInstance } from 'fastify';
import { BackupController } from './controllers/BackupController';

export async function backupRoutes(fastify: FastifyInstance) {
  const controller = new BackupController();

  // GET /api/backup/export
  fastify.get('/export', { preHandler: [fastify.authenticate] }, controller.export.bind(controller));

  // POST /api/backup/import
  fastify.post('/import', { preHandler: [fastify.authenticate] }, controller.import.bind(controller));
}

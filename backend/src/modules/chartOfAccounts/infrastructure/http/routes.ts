import { FastifyInstance } from 'fastify';
import { ChartOfAccountsController } from './controllers/ChartOfAccountsController';
import { SpedMappingController } from './controllers/SpedMappingController';

export async function chartOfAccountsRoutes(fastify: FastifyInstance) {
  const controller = new ChartOfAccountsController();
  const spedController = new SpedMappingController();

  fastify.get('/v2/chart-of-accounts', { preHandler: [fastify.authenticate] }, controller.list.bind(controller));
  fastify.post('/v2/chart-of-accounts', { preHandler: [fastify.authenticate] }, controller.create.bind(controller));
  fastify.put('/v2/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, controller.update.bind(controller));
  fastify.delete('/v2/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, controller.delete.bind(controller));
  fastify.patch('/v2/chart-of-accounts/:id/restore', { preHandler: [fastify.authenticate] }, controller.restore.bind(controller));
  fastify.post('/v2/chart-of-accounts/reset', { preHandler: [fastify.authenticate] }, controller.reset.bind(controller));

  // Mapeamentos SPED (Configurações Financeiras)
  fastify.get('/v2/sped-mappings', { preHandler: [fastify.authenticate] }, spedController.list.bind(spedController));
  fastify.post('/v2/sped-mappings', { preHandler: [fastify.authenticate] }, spedController.update.bind(spedController));
  
  // Tipos de Insumo Dinâmicos
  fastify.get('/v2/material-types', { preHandler: [fastify.authenticate] }, spedController.listTypes.bind(spedController));
  fastify.post('/v2/material-types', { preHandler: [fastify.authenticate] }, spedController.createType.bind(spedController));
  fastify.put('/v2/material-types', { preHandler: [fastify.authenticate] }, spedController.updateType.bind(spedController));
  fastify.delete('/v2/material-types/:id', { preHandler: [fastify.authenticate] }, spedController.deleteType.bind(spedController));
}

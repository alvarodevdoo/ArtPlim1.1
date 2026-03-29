import { FastifyInstance } from 'fastify';
import { ChartOfAccountsController } from './controllers/ChartOfAccountsController';

export async function chartOfAccountsRoutes(fastify: FastifyInstance) {
  const controller = new ChartOfAccountsController();

  fastify.get('/v2/chart-of-accounts', { preHandler: [fastify.authenticate] }, controller.list.bind(controller));
  fastify.post('/v2/chart-of-accounts', { preHandler: [fastify.authenticate] }, controller.create.bind(controller));
  fastify.put('/v2/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, controller.update.bind(controller));
  fastify.delete('/v2/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, controller.delete.bind(controller));
  fastify.patch('/v2/chart-of-accounts/:id/restore', { preHandler: [fastify.authenticate] }, controller.restore.bind(controller));
  fastify.post('/v2/chart-of-accounts/reset', { preHandler: [fastify.authenticate] }, controller.reset.bind(controller));
}

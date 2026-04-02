import { FastifyInstance } from 'fastify';
import { NFeController } from './controllers/NFeController';

export async function nfeRoutes(fastify: FastifyInstance) {
  const nfeController = new NFeController();

  // 1. Processar o Upload do XML
  fastify.post('/parse', {
    preHandler: [fastify.authenticate]
  }, nfeController.parseXml.bind(nfeController));

  // 2. Importar Efetivamente
  fastify.post('/import', {
    preHandler: [fastify.authenticate]
  }, nfeController.importProcessedXml.bind(nfeController));
}

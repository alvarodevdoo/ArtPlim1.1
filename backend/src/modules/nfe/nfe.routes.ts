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
  // 3. Buscar pela Chave (Automático via SEFAZ)
  fastify.post('/fetch', {
    preHandler: [fastify.authenticate]
  }, nfeController.fetchByChave.bind(nfeController));

  // 4. Histórico de importações de NF-e
  fastify.get('/imports', {
    preHandler: [fastify.authenticate]
  }, nfeController.listImports.bind(nfeController));

  // 5. Checar se uma chave já foi importada (e quais itens)
  fastify.get('/imports/check', {
    preHandler: [fastify.authenticate]
  }, nfeController.checkImport.bind(nfeController));

  // 6. Detalhe completo de uma importação (NF-e completa)
  fastify.get('/imports/:id', {
    preHandler: [fastify.authenticate]
  }, nfeController.getImport.bind(nfeController));
}

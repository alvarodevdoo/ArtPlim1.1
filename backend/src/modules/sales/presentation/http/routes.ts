import { FastifyInstance } from 'fastify';
import { OrderController } from './OrderController';
import { AuthorizationController } from './AuthorizationController';

export async function orderRoutes(fastify: FastifyInstance, orderController: OrderController, authorizationController: AuthorizationController) {
  // Criar pedido
  fastify.post('/orders', {
    preHandler: [fastify.authenticate]
  }, orderController.create.bind(orderController));

  // Obter estatísticas dos pedidos (DEVE VIR ANTES da rota /:id)
  fastify.get('/orders/stats', {
    preHandler: [fastify.authenticate]
  }, orderController.getStats.bind(orderController));

  // Listar pedidos
  fastify.get('/orders', {
    preHandler: [fastify.authenticate]
  }, orderController.list.bind(orderController));

  // Buscar pedido por ID
  fastify.get('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, orderController.getById.bind(orderController));

  // Histórico do pedido
  fastify.get('/orders/:id/history', {
    preHandler: [fastify.authenticate]
  }, orderController.getHistory.bind(orderController));

  // Atualizar pedido
  fastify.put('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, orderController.update.bind(orderController));

  // Atualizar status do pedido
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, orderController.updateStatus.bind(orderController));

  // Confirmar/Aprovar pedido
  fastify.post('/orders/:id/confirm', {
    preHandler: [fastify.authenticate]
  }, orderController.confirm.bind(orderController));

  // Finalizar pedido
  fastify.post('/orders/:id/finish', {
    preHandler: [fastify.authenticate]
  }, orderController.finish.bind(orderController));

  // Reabrir pedido
  fastify.post('/orders/:id/reopen', {
    preHandler: [fastify.authenticate]
  }, orderController.reopen.bind(orderController));

  // Regenerar produção
  fastify.post('/orders/:id/regenerate', {
    preHandler: [fastify.authenticate]
  }, orderController.regenerate.bind(orderController));

  // Cancelar itens do pedido
  fastify.patch('/orders/:id/cancel-items', {
    preHandler: [fastify.authenticate]
  }, orderController.cancelItems.bind(orderController));

  // Entregar/Gerar Romaneio
  fastify.post('/orders/:id/deliveries', {
    preHandler: [fastify.authenticate]
  }, orderController.createDelivery.bind(orderController));

  // Registrar Perda/Lixo
  fastify.post('/orders/:id/items/:itemId/waste', {
    preHandler: [fastify.authenticate]
  }, orderController.reportWaste.bind(orderController));

  // Simular preço de item (Fórmula)
  fastify.post('/simulate', {
    preHandler: [fastify.authenticate]
  }, orderController.simulate.bind(orderController));

  // Simular composição (Custo/Lucro real)
  fastify.post('/simulate-composition', {
    preHandler: [fastify.authenticate]
  }, orderController.simulateComposition.bind(orderController));

  // Incompatibilidades de variações
  fastify.get('/orders/incompatibilities', {
    preHandler: [fastify.authenticate]
  }, orderController.getIncompatibilities.bind(orderController));

  // ========== AUTORIZAÇÕES ==========

  // Criar solicitação de autorização
  fastify.post('/authorizations/request', {
    preHandler: [fastify.authenticate]
  }, authorizationController.createRequest.bind(authorizationController));

  // Listar solicitações pendentes (para supervisores)
  fastify.get('/authorizations/pending', {
    preHandler: [fastify.authenticate]
  }, authorizationController.listPending.bind(authorizationController));

  // Verificar status de uma solicitação
  fastify.get('/authorizations/:id', {
    preHandler: [fastify.authenticate]
  }, authorizationController.getStatus.bind(authorizationController));

  // Revisar solicitação (Aprovar/Rejeitar)
  fastify.post('/authorizations/:id/review', {
    preHandler: [fastify.authenticate]
  }, authorizationController.review.bind(authorizationController));
}
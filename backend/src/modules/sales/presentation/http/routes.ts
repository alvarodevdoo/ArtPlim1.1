import { FastifyInstance } from 'fastify';
import { OrderController } from './OrderController';

export async function orderRoutes(fastify: FastifyInstance, orderController: OrderController) {
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

  // Atualizar pedido
  fastify.put('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, orderController.update.bind(orderController));

  // Atualizar status do pedido
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, orderController.updateStatus.bind(orderController));

  // Cancelar itens do pedido
  fastify.patch('/orders/:id/cancel-items', {
    preHandler: [fastify.authenticate]
  }, orderController.cancelItems.bind(orderController));

  // Entregar/Gerar Romaneio
  fastify.post('/orders/:id/deliveries', {
    preHandler: [fastify.authenticate]
  }, orderController.createDelivery.bind(orderController));

  // Simular preço de item
  fastify.post('/simulate', {
    preHandler: [fastify.authenticate]
  }, orderController.simulate.bind(orderController));
}
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

  // Listar pedidos (temporariamente sem auth para debug)
  fastify.get('/orders', {
    // preHandler: [fastify.authenticate]  // Comentado temporariamente
  }, orderController.list.bind(orderController));

  // Buscar pedido por ID
  fastify.get('/orders/:id', {
    preHandler: [fastify.authenticate]
  }, orderController.getById.bind(orderController));

  // Atualizar status do pedido
  fastify.patch('/orders/:id/status', {
    preHandler: [fastify.authenticate]
  }, orderController.updateStatus.bind(orderController));
}
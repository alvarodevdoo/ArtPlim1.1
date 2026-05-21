import { FastifyInstance } from 'fastify';
import { OrderController } from './OrderController';
import { AuthorizationController } from './AuthorizationController';
import { SalesReportController } from './SalesReportController';
import { StockReservationService } from '../../../wms/services/StockReservationService';
import { getTenantClient } from '../../../../shared/infrastructure/database/tenant';

export async function orderRoutes(
  fastify: FastifyInstance,
  orderController: OrderController,
  authorizationController: AuthorizationController,
  salesReportController: SalesReportController,
) {
  // Verificar disponibilidade de estoque antes de adicionar item ao pedido
  fastify.post('/orders/check-stock', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = request.body as {
      items: Array<{ productId: string; quantity: number; selectedOptionIds?: string[] }>;
      excludeOrderId?: string;
    };
    const organizationId = (request as any).user!.organizationId;
    const prisma = getTenantClient(organizationId);

    // Coletar materiais via opções de configuração (slot direto + ficha técnica)
    const allOptionIds = body.items.flatMap(i => i.selectedOptionIds || []).filter(Boolean);
    const materialMap = new Map<string, number>();

    if (allOptionIds.length > 0) {
      // 1) Materiais diretos: ConfigurationOption.materialId
      const opts = await prisma.configurationOption.findMany({
        where: { id: { in: allOptionIds }, materialId: { not: null } },
        select: { id: true, materialId: true, slotQuantity: true }
      });
      const optMap = new Map<string, { materialId: string; slotQuantity: number }>(
        opts.map((o: any) => [o.id, { materialId: o.materialId, slotQuantity: Number(o.slotQuantity || 1) }])
      );

      for (const item of body.items) {
        for (const optId of (item.selectedOptionIds || [])) {
          const info = optMap.get(optId);
          if (!info?.materialId) continue;
          const qty = info.slotQuantity * item.quantity;
          materialMap.set(info.materialId, (materialMap.get(info.materialId) || 0) + qty);
        }
      }

      // 2) Materiais via FichaTecnicaInsumo linkado às opções selecionadas
      const ftItems = await prisma.fichaTecnicaInsumo.findMany({
        where: { configurationOptionId: { in: allOptionIds }, organizationId, insumoId: { not: null } },
        select: { insumoId: true, quantidade: true, configurationOptionId: true }
      });
      for (const item of body.items) {
        for (const optId of (item.selectedOptionIds || [])) {
          const ftsDessaOpcao = ftItems.filter((f: any) => f.configurationOptionId === optId);
          for (const ft of ftsDessaOpcao) {
            if (!ft.insumoId) continue;
            const qty = Number(ft.quantidade || 0) * item.quantity;
            materialMap.set(ft.insumoId, (materialMap.get(ft.insumoId) || 0) + qty);
          }
        }
      }
    }

    // FichaTecnicaInsumo direta do produto (BOM padrão)
    const productIds = body.items.map(i => i.productId);
    const productFt = await prisma.fichaTecnicaInsumo.findMany({
      where: { productId: { in: productIds }, organizationId, configurationOptionId: null, insumoId: { not: null } },
      select: { insumoId: true, quantidade: true, productId: true }
    });
    for (const item of body.items) {
      const fts = productFt.filter((f: any) => f.productId === item.productId);
      for (const ft of fts) {
        if (!ft.insumoId) continue;
        const qty = Number(ft.quantidade || 0) * item.quantity;
        materialMap.set(ft.insumoId, (materialMap.get(ft.insumoId) || 0) + qty);
      }
    }

    const reservationService = new StockReservationService(prisma);
    const result = await reservationService.checkAvailability(
      organizationId,
      body.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      materialMap,
      body.excludeOrderId
    );

    return reply.send({
      success: true,
      data: {
        ok: result.ruptures.length === 0,
        ruptures: result.ruptures,
        breakdown: result.breakdown
      }
    });
  });

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

  // Listar materiais consumidos por um pedido (para modal de cancelamento)
  fastify.get('/orders/:id/materials', {
    preHandler: [fastify.authenticate]
  }, orderController.getMaterials.bind(orderController));

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

  // ========== RELATÓRIO DE VENDAS ==========

  // GET /api/sales/reports/sales?startDate=...&endDate=...
  fastify.get('/reports/sales', {
    preHandler: [fastify.authenticate]
  }, salesReportController.getSalesReport.bind(salesReportController));
}
import { FastifyInstance } from 'fastify';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { FichaTecnicaService } from './services/FichaTecnicaService';

export async function fichaTecnicaRoutes(fastify: FastifyInstance) {
  
  // GET /api/catalog/:targetType/:targetId/ficha-tecnica
  fastify.get('/:targetType/:targetId/ficha-tecnica', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new FichaTecnicaService(prisma);

    const items = await service.getByTarget(request.user!.organizationId, targetId);
    return reply.send({ success: true, data: items });
  });

  // POST /api/catalog/:targetType/:targetId/ficha-tecnica
  fastify.post('/:targetType/:targetId/ficha-tecnica', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { targetType, targetId } = request.params as { targetType: string, targetId: string };
    const { items } = request.body as { items: any[] };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new FichaTecnicaService(prisma);

    const data: any = {
      organizationId: request.user!.organizationId,
      items
    };

    if (targetType === 'products') {
      data.productId = targetId;
    } else if (targetType === 'options') {
      data.configurationOptionId = targetId;
    } else {
      return reply.code(400).send({ success: false, error: { message: 'Alvo inválido (products ou options).' } });
    }

    const result = await service.save(request.user!.organizationId, data);
    return reply.send({ success: true, data: result });
  });
}

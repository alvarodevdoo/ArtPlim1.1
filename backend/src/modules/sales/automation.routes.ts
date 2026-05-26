import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const triggerEnum = z.enum(['status_change', 'time_based', 'overdue', 'manual']);
const actionEnum = z.enum(['whatsapp', 'email', 'notification', 'status_update']);

const createRuleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().nullish(),
  trigger: triggerEnum,
  action: actionEnum,
  conditions: z.record(z.any()).default({}),
  enabled: z.boolean().default(true),
});

const updateRuleSchema = createRuleSchema.partial();

export async function automationRoutes(fastify: FastifyInstance) {
  // Listar regras
  fastify.get('/rules', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const rules = await prisma.automationRule.findMany({
      where: { organizationId: request.user!.organizationId },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send({ success: true, data: rules });
  });

  // Criar regra
  fastify.post('/rules', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = createRuleSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);
      const rule = await prisma.automationRule.create({
        data: {
          organizationId: request.user!.organizationId,
          name: body.name,
          description: body.description ?? null,
          trigger: body.trigger,
          action: body.action,
          conditions: body.conditions,
          enabled: body.enabled,
        }
      });
      return reply.code(201).send({ success: true, data: rule });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ success: false, message: 'Já existe uma regra com esse nome.' });
      }
      return reply.code(error.name === 'ZodError' ? 400 : 500).send({
        success: false,
        message: error.message,
        details: error.name === 'ZodError' ? error.errors : undefined
      });
    }
  });

  // Atualizar regra
  fastify.put('/rules/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateRuleSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);

      const existing = await prisma.automationRule.findFirst({
        where: { id, organizationId: request.user!.organizationId }
      });
      if (!existing) {
        return reply.code(404).send({ success: false, message: 'Regra não encontrada' });
      }

      const rule = await prisma.automationRule.update({
        where: { id },
        data: body as any
      });
      return reply.send({ success: true, data: rule });
    } catch (error: any) {
      return reply.code(error.name === 'ZodError' ? 400 : 500).send({
        success: false,
        message: error.message
      });
    }
  });

  // Excluir regra
  fastify.delete('/rules/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Regra não encontrada' });
    }
    await prisma.automationRule.delete({ where: { id } });
    return reply.send({ success: true, message: 'Regra excluída' });
  });

  // Alternar enabled
  fastify.patch('/rules/:id/toggle', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Regra não encontrada' });
    }
    const rule = await prisma.automationRule.update({
      where: { id },
      data: { enabled: !existing.enabled }
    });
    return reply.send({ success: true, data: rule });
  });

  // Executar regra (registro de execução)
  fastify.post('/rules/:id/execute', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) ?? {};
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    const prisma = getTenantClient(request.user!.organizationId);

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Regra não encontrada' });
    }

    const now = new Date();
    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        lastRun: now,
        runCount: { increment: orderIds.length || 1 }
      }
    });

    return reply.send({
      success: true,
      data: { ...rule, executedAt: now.toISOString(), affectedOrderIds: orderIds }
    });
  });
}

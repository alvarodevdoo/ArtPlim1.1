import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['PIX', 'CARD', 'CASH', 'TRANSFER', 'BOLETO', 'OTHER']),
  feePercentage: z.number().min(0).default(0),
  installmentRules: z.object({
    maxInstallments: z.number().min(1).optional(),
    interestFreeInstallments: z.number().min(1).optional(),
  }).optional(),
  accountId: z.string().nullish(),
  active: z.boolean().default(true),
});

const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export async function paymentMethodRoutes(fastify: FastifyInstance) {
  
  // List all
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const methods = await prisma.paymentMethod.findMany({
      where: { organizationId: request.user!.organizationId },
      include: { account: true },
      orderBy: { name: 'asc' }
    });
    return reply.send({ success: true, data: methods });
  });

  // Get one
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const method = await prisma.paymentMethod.findFirst({
      where: { id, organizationId: request.user!.organizationId },
      include: { account: true }
    });
    if (!method) return reply.code(404).send({ success: false, message: 'Não encontrado' });
    return reply.send({ success: true, data: method });
  });

  // Create
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = createPaymentMethodSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const method = await prisma.paymentMethod.create({
      data: { 
        ...data, 
        organizationId: request.user!.organizationId,
        accountId: data.accountId || null
      }
    });
    return reply.code(201).send({ success: true, data: method });
  });

  // Update
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updatePaymentMethodSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    
    const existing = await prisma.paymentMethod.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });
    if (!existing) return reply.code(404).send({ success: false, message: 'Não encontrado' });

    const method = await prisma.paymentMethod.update({
      where: { id },
      data: {
        ...data,
        accountId: data.accountId === undefined ? undefined : (data.accountId || null)
      }
    });
    return reply.send({ success: true, data: method });
  });

  // Toggle
  fastify.patch('/:id/toggle-status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    
    const existing = await prisma.paymentMethod.findFirst({
      where: { id, organizationId: request.user!.organizationId }
    });
    if (!existing) return reply.code(404).send({ success: false, message: 'Não encontrado' });

    const method = await prisma.paymentMethod.update({
      where: { id },
      data: { active: !existing.active }
    });
    return reply.send({ success: true, data: method });
  });

  // Delete
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    
    const usageCount = await prisma.transaction.count({
      where: { paymentMethodId: id, organizationId: request.user!.organizationId }
    });
    if (usageCount > 0) {
      return reply.code(400).send({ success: false, message: 'Possui transações vinculadas.' });
    }

    await prisma.paymentMethod.delete({
      where: { id, organizationId: request.user!.organizationId }
    });
    return reply.send({ success: true, message: 'Removido com sucesso' });
  });
}

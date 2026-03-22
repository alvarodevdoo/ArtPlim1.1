import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ItemType, BudgetStatus } from '@prisma/client';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const createBudgetSchema = z.object({
    customerId: z.string().min(1),
    items: z.array(z.object({
        productId: z.string().min(1),
        itemType: z.string().optional(),
        width: z.coerce.number().min(0).optional(),
        height: z.coerce.number().min(0).optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        totalPrice: z.number().min(0),
        costPrice: z.number().min(0).optional(),
        calculatedPrice: z.number().min(0).optional(),
        attributes: z.any().optional(),
        pricingRuleId: z.string().optional(),
        notes: z.string().optional()
    })),
    notes: z.string().optional(),
    validUntil: z.string().optional().nullable()
});

const updateBudgetSchema = createBudgetSchema.partial();

export async function budgetRoutes(fastify: FastifyInstance) {
    
    // Listar orçamentos
    fastify.get('/', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const query = request.query as any;
        const page = parseInt(query.page as string) || 1;
        const limit = parseInt(query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const prisma = getTenantClient(request.user!.organizationId);

        const budgets = await prisma.budget.findMany({
            where: { organizationId: request.user!.organizationId },
            include: {
                customer: { select: { id: true, name: true } },
                items: { include: { product: { include: { pricingRule: { select: { id: true, name: true, formula: true, config: true } } } } } }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });

        const total = await prisma.budget.count({
            where: { organizationId: request.user!.organizationId }
        });

        return reply.send({
            success: true,
            data: budgets,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    });

    // Obter por ID
    fastify.get('/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const prisma = getTenantClient(request.user!.organizationId);

        const budget = await prisma.budget.findFirst({
            where: { id, organizationId: request.user!.organizationId },
            include: {
                customer: true,
                items: { include: { product: { include: { pricingRule: { select: { id: true, name: true, formula: true, config: true } } } } } }
            }
        });

        if (!budget) return reply.code(404).send({ success: false, message: 'Não encontrado' });
        
        // Substituir as regras pela histórica caso exista
        for (const item of budget.items) {
            if (item.pricingRuleId && item.product) {
                const fixedRule = await prisma.pricingRule.findUnique({
                    where: { id: item.pricingRuleId },
                    select: { id: true, name: true, formula: true, config: true }
                });
                if (fixedRule) {
                    (item.product as any).pricingRule = fixedRule;
                }
            }
        }

        return reply.send({ success: true, data: budget });
    });

    // Criar
    fastify.post('/', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const body = createBudgetSchema.parse(request.body);
        const prisma = getTenantClient(request.user!.organizationId);

        const budgetCount = await prisma.budget.count({
            where: { organizationId: request.user!.organizationId }
        });
        const budgetNumber = `ORC-${String(budgetCount + 1).padStart(4, '0')}`;
        const subtotal = body.items.reduce((sum, item) => sum + item.totalPrice, 0);

        const budget = await prisma.budget.create({
            data: {
                organizationId: request.user!.organizationId,
                customerId: body.customerId,
                budgetNumber,
                status: 'DRAFT',
                subtotal,
                total: subtotal,
                notes: body.notes,
                validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
                items: {
                    create: body.items.map(item => ({
                        productId: item.productId,
                        itemType: item.itemType ? (item.itemType as ItemType) : 'PRODUCT',
                        width: item.width,
                        height: item.height,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        costPrice: item.costPrice || 0,
                        calculatedPrice: item.calculatedPrice || 0,
                        attributes: item.attributes || {},
                        pricingRuleId: item.pricingRuleId,
                        notes: item.notes
                    }))
                }
            },
            include: { items: true }
        });
        return reply.code(201).send({ success: true, data: budget });
    });

    // Atualizar
    fastify.put('/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = updateBudgetSchema.parse(request.body);
        const prisma = getTenantClient(request.user!.organizationId);

        console.log('[DEBUG] PUT /budgets body:', JSON.stringify(body, null, 2));

        try {
            const existing = await prisma.budget.findFirst({
            where: { id, organizationId: request.user!.organizationId }
        });
        if (!existing) return reply.code(404).send({ success: false, message: 'Não encontrado' });

        const data: any = {};
        if (body.customerId !== undefined) data.customerId = body.customerId;
        if (body.notes !== undefined) data.notes = body.notes;
        if (body.validUntil !== undefined) {
            if (body.validUntil) {
                const d = new Date(body.validUntil);
                if (isNaN(d.getTime())) {
                    return reply.code(400).send({ success: false, message: 'Data de validade inválida' });
                }
                data.validUntil = d;
            } else {
                data.validUntil = null;
            }
        }

        if (body.items) {
            const subtotal = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
            data.subtotal = subtotal;
            data.total = subtotal;
            await prisma.budgetItem.deleteMany({ where: { budgetId: id } });
            data.items = {
                create: body.items.map(item => ({
                    productId: item.productId,
                    itemType: item.itemType ? (item.itemType as ItemType) : 'PRODUCT',
                    width: item.width,
                    height: item.height,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    costPrice: item.costPrice || 0,
                    calculatedPrice: item.calculatedPrice || 0,
                    attributes: item.attributes || {},
                    pricingRuleId: item.pricingRuleId,
                    notes: item.notes
                }))
            };
        }

        const updated = await prisma.budget.update({
            where: { id },
            data,
            include: { items: true }
        });
        return reply.send({ success: true, data: updated });
    } catch (error) {
        console.error('[ERROR] PUT /budgets:', error);
        return reply.code(500).send({ success: false, message: 'Internal Server Error', error: String(error) });
    }
});

    // Status
    fastify.patch('/:id/status', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { status } = request.body as { status: BudgetStatus };
        const prisma = getTenantClient(request.user!.organizationId);

        const result = await prisma.budget.updateMany({
            where: { id, organizationId: request.user!.organizationId },
            data: { status }
        });

        if (result.count === 0) return reply.code(404).send({ success: false, message: 'Não encontrado' });
        return reply.send({ success: true, message: 'Status atualizado' });
    });
}

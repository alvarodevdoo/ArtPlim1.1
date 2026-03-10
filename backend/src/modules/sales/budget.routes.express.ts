import { Router } from 'express';
import { PrismaClient, ItemType } from '@prisma/client';
import { z } from 'zod';

const createBudgetSchema = z.object({
    customerId: z.string().min(1),
    items: z.array(z.object({
        productId: z.string().min(1),
        itemType: z.string().optional(),
        width: z.number().min(0).optional(),
        height: z.number().min(0).optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        totalPrice: z.number().min(0),
        costPrice: z.number().min(0).optional(),
        calculatedPrice: z.number().min(0).optional(),
        attributes: z.any().optional(),
        notes: z.string().optional()
    })),
    notes: z.string().optional(),
    validUntil: z.string().optional().nullable()
});

const updateBudgetSchema = createBudgetSchema.partial();

export function createBudgetRoutes(prisma: PrismaClient) {
    const router = Router();

    // Listar orçamentos
    router.get('/', async (req: any, res) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            const budgets = await prisma.budget.findMany({
                where: {
                    organizationId: req.user.organizationId
                },
                include: {
                    customer: {
                        select: { id: true, name: true }
                    },
                    items: {
                        include: {
                            product: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit
            });

            const total = await prisma.budget.count({
                where: { organizationId: req.user.organizationId }
            });

            res.json({
                success: true,
                data: budgets,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Erro ao listar orçamentos:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Obter orçamento por ID
    router.get('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const budget = await prisma.budget.findFirst({
                where: {
                    id,
                    organizationId: req.user.organizationId
                },
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            if (!budget) {
                return res.status(404).json({ success: false, message: 'Orçamento não encontrado' });
            }

            res.json({ success: true, data: budget });
        } catch (error) {
            console.error('Erro ao buscar orçamento:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Criar orçamento
    router.post('/', async (req: any, res) => {
        try {
            const body = createBudgetSchema.parse(req.body);

            // Gerar número do orçamento
            const budgetCount = await prisma.budget.count({
                where: { organizationId: req.user.organizationId }
            });
            const budgetNumber = `ORC-${String(budgetCount + 1).padStart(4, '0')}`;

            // Calcular totais
            const subtotal = body.items.reduce((sum, item) => sum + item.totalPrice, 0);

            const budget = await prisma.budget.create({
                data: {
                    organizationId: req.user.organizationId,
                    customerId: body.customerId,
                    budgetNumber,
                    status: 'DRAFT',
                    subtotal,
                    total: subtotal, // Pode adicionar lógica de impostos/descontos futuramente
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
                            notes: item.notes
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            res.status(201).json({ success: true, data: budget });
        } catch (error) {
            console.error('Erro ao criar orçamento:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ success: false, message: 'Dados inválidos', details: error.errors });
            }
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Atualizar orçamento
    router.put('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const body = updateBudgetSchema.parse(req.body);

            const existingBudget = await prisma.budget.findFirst({
                where: { id, organizationId: req.user.organizationId }
            });

            if (!existingBudget) {
                return res.status(404).json({ success: false, message: 'Orçamento não encontrado' });
            }

            // Preparar atualização
            const data: any = {};
            // Atualizar campos apenas se foram enviados no corpo da requisição
            if (body.customerId !== undefined) data.customerId = body.customerId;
            if (body.notes !== undefined) data.notes = body.notes;

            // Tratar data de validade
            if (body.validUntil !== undefined) {
                // Se vier string vazia ou null, definimos como null no banco (se permitido) ou ignoramos
                // O schema define como optional string. 
                if (body.validUntil) {
                    data.validUntil = new Date(body.validUntil);
                } else {
                    // Se for string vazia, podemos querer limpar a data ou manter. 
                    // Vamos assumir que string vazia = remover validade (null) se o prisma permitir, 
                    // mas o campo no banco é DateTime?, então aceita null.
                    data.validUntil = null;
                }
            }

            // Se atualizar itens, recalcular total
            if (body.items) {
                const subtotal = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
                data.subtotal = subtotal;
                data.total = subtotal;

                // Limpar itens antigos
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
                        notes: item.notes
                    }))
                };
            }

            const updatedBudget = await prisma.budget.update({
                where: { id },
                data,
                include: { items: true }
            });

            res.json({ success: true, data: updatedBudget });

        } catch (error) {
            console.error('Erro ao atualizar orçamento:', error);
            if (error instanceof z.ZodError) {
                console.error('Detalhes do erro Zod:', JSON.stringify(error.errors, null, 2));
                return res.status(400).json({ success: false, message: 'Dados inválidos', details: error.errors });
            }
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    // Atualizar status
    router.patch('/:id/status', async (req: any, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) return res.status(400).json({ success: false, message: 'Status obrigatório' });

            const updatedBudget = await prisma.budget.updateMany({
                where: { id, organizationId: req.user.organizationId },
                data: { status }
            });

            if (updatedBudget.count === 0) {
                return res.status(404).json({ success: false, message: 'Orçamento não encontrado' });
            }

            res.json({ success: true, message: 'Status atualizado' });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    });

    return router;
}

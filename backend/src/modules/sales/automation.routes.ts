import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const automationRuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    trigger: z.enum(['status_change', 'time_based', 'overdue', 'manual']),
    action: z.enum(['whatsapp', 'email', 'notification', 'status_update']),
    conditions: z.any(),
    enabled: z.boolean(),
    runCount: z.number().default(0),
    lastRun: z.string().optional()
});

const createRuleSchema = automationRuleSchema.omit({ id: true, runCount: true, lastRun: true });
const updateRuleSchema = automationRuleSchema.partial();

export function createAutomationRoutes(prisma?: PrismaClient) {
    const router = Router();

    // Use global prisma if not provided
    const db = prisma || new PrismaClient();

    // Regras padrão para inicialização
    const getDefaultRules = () => [
        {
            name: 'Lembrete de Orçamento Vencendo',
            description: 'Envia WhatsApp 1 dia antes do vencimento do orçamento',
            trigger: 'time_based',
            action: 'whatsapp',
            conditions: { daysBeforeExpiry: 1, status: 'DRAFT' },
            enabled: true
        },
        {
            name: 'Notificação de Produção Iniciada',
            description: 'Notifica cliente quando pedido entra em produção',
            trigger: 'status_change',
            action: 'whatsapp',
            conditions: { fromStatus: 'APPROVED', toStatus: 'IN_PRODUCTION' },
            enabled: true
        },
        {
            name: 'Follow-up Pós-Entrega',
            description: 'Envia pesquisa de satisfação 3 dias após entrega',
            trigger: 'time_based',
            action: 'whatsapp',
            conditions: { daysAfterDelivery: 3, status: 'DELIVERED' },
            enabled: false
        },
        {
            name: 'Alerta de Pedido Parado',
            description: 'Alerta interno para pedidos há mais de 5 dias no mesmo status',
            trigger: 'time_based',
            action: 'notification',
            conditions: { daysInSameStatus: 5 },
            enabled: true
        }
    ];

    // Inicializar regras padrão se não existirem
    const ensureDefaultRules = async (organizationId: string) => {
        const existingRules = await db.automationRule.count({
            where: { organizationId }
        });

        if (existingRules === 0) {
            const defaultRules = getDefaultRules();
            await db.automationRule.createMany({
                data: defaultRules.map(rule => ({
                    ...rule,
                    organizationId,
                    conditions: rule.conditions as any
                }))
            });
        }
    };

    // GET /api/sales/automation/rules - Listar regras
    router.get('/rules', async (req: any, res) => {
        try {
            await ensureDefaultRules(req.user.organizationId);

            const rules = await db.automationRule.findMany({
                where: { organizationId: req.user.organizationId },
                orderBy: { createdAt: 'asc' }
            });

            res.json({
                success: true,
                data: rules
            });
        } catch (error) {
            console.error('Erro ao carregar regras de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    // POST /api/sales/automation/rules - Criar regra
    router.post('/rules', async (req: any, res) => {
        try {
            const ruleData = createRuleSchema.parse(req.body);

            const newRule = await db.automationRule.create({
                data: {
                    ...ruleData,
                    organizationId: req.user.organizationId,
                    conditions: ruleData.conditions as any
                }
            });

            res.json({
                success: true,
                data: newRule
            });
        } catch (error) {
            console.error('Erro ao criar regra de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    // PUT /api/sales/automation/rules/:id - Atualizar regra
    router.put('/rules/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const updateData = updateRuleSchema.parse(req.body);

            const updatedRule = await db.automationRule.update({
                where: {
                    id,
                    organizationId: req.user.organizationId
                },
                data: {
                    ...updateData,
                    conditions: updateData.conditions as any
                }
            });

            res.json({
                success: true,
                data: updatedRule
            });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({
                    success: false,
                    message: 'Regra não encontrada'
                });
            }

            console.error('Erro ao atualizar regra de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    // DELETE /api/sales/automation/rules/:id - Deletar regra
    router.delete('/rules/:id', async (req: any, res) => {
        try {
            const { id } = req.params;

            await db.automationRule.delete({
                where: {
                    id,
                    organizationId: req.user.organizationId
                }
            });

            res.json({
                success: true,
                message: 'Regra deletada com sucesso'
            });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({
                    success: false,
                    message: 'Regra não encontrada'
                });
            }

            console.error('Erro ao deletar regra de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    // PATCH /api/sales/automation/rules/:id/toggle - Alternar status da regra
    router.patch('/rules/:id/toggle', async (req: any, res) => {
        try {
            const { id } = req.params;

            const rule = await db.automationRule.findUnique({
                where: {
                    id,
                    organizationId: req.user.organizationId
                }
            });

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    message: 'Regra não encontrada'
                });
            }

            const updatedRule = await db.automationRule.update({
                where: { id },
                data: { enabled: !rule.enabled }
            });

            res.json({
                success: true,
                data: updatedRule
            });
        } catch (error) {
            console.error('Erro ao alternar regra de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    // POST /api/sales/automation/rules/:id/execute - Executar regra manualmente
    router.post('/rules/:id/execute', async (req: any, res) => {
        try {
            const { id } = req.params;
            const { orderIds } = req.body;

            const rule = await db.automationRule.findUnique({
                where: {
                    id,
                    organizationId: req.user.organizationId
                }
            });

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    message: 'Regra não encontrada'
                });
            }

            // Atualizar contador e última execução
            const updatedRule = await db.automationRule.update({
                where: { id },
                data: {
                    runCount: rule.runCount + (orderIds?.length || 1),
                    lastRun: new Date()
                }
            });

            res.json({
                success: true,
                data: {
                    ruleId: id,
                    executedAt: updatedRule.lastRun,
                    affectedOrders: orderIds?.length || 0
                }
            });
        } catch (error) {
            console.error('Erro ao executar regra de automação:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    });

    return router;
}
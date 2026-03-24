import { ItemType } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreatePricingRuleInput {
    name: string;
    type: ItemType;
    formula: any; // Using any for flexibility with JSON
    config?: any;
    active?: boolean;
    organizationId: string;
}

export class PricingRuleService {
    constructor(private prisma: any) { }

    async create(data: CreatePricingRuleInput) {
        return this.prisma.pricingRule.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                type: data.type,
                formula: data.formula,
                config: data.config || null,
                active: data.active ?? true
            }
        });
    }

    async list() {
        return this.prisma.pricingRule.findMany({
            where: {
                active: true,
                isLatest: true
            },
            include: {
                _count: {
                    select: { orderItems: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
    }

    async findById(id: string) {
        const rule = await this.prisma.pricingRule.findUnique({
            where: { id }
        });

        if (!rule) {
            throw new NotFoundError('Regra de Precificação');
        }

        return rule;
    }

    async update(id: string, data: Partial<CreatePricingRuleInput>) {
        // 1. Verificar se a regra atual já foi usada em algum pedido
        const currentRule = await this.prisma.pricingRule.findUnique({
            where: { id },
            include: { orderItems: { take: 1 } }
        });

        if (!currentRule) {
            throw new NotFoundError('Regra de Precificação');
        }

        const formulaChanged = data.formula && JSON.stringify(data.formula) !== JSON.stringify(currentRule.formula);
        const configChanged = data.config && JSON.stringify(data.config) !== JSON.stringify(currentRule.config);
        const isUsed = currentRule.orderItems.length > 0;

        // 2. Se a regra já foi usada e a fórmula/config mudou, criar uma NOVA versão
        if (isUsed && (formulaChanged || configChanged)) {
            console.log(`[PricingRuleService] Regra ${id} em uso. Criando nova versão.`);
            
            return await this.prisma.$transaction(async (tx: any) => {
                // Desativar a versão antiga como "LATEST"
                await tx.pricingRule.update({
                    where: { id },
                    data: { isLatest: false }
                });

                // Criar a nova versão
                const newRule = await tx.pricingRule.create({
                    data: {
                        organizationId: currentRule.organizationId,
                        parentId: currentRule.parentId || currentRule.id, // Vínculo com a raiz
                        name: data.name || currentRule.name,
                        type: data.type || currentRule.type,
                        formula: data.formula || currentRule.formula,
                        config: data.config || currentRule.config,
                        active: data.active ?? currentRule.active,
                        version: (currentRule.version || 1) + 1,
                        isLatest: true
                    }
                });

                // Atualizar todos os produtos que apontavam para a regra antiga
                await tx.product.updateMany({
                    where: { pricingRuleId: id },
                    data: { pricingRuleId: newRule.id }
                });

                return newRule;
            });
        }

        // 3. Caso contrário, atualizar a regra existente normalmente
        const updateData: any = { ...data };
        
        const { organizationId: _orgId, ...finalUpdateData } = updateData;

        return this.prisma.pricingRule.update({
            where: { id },
            data: {
                ...finalUpdateData,
                updatedAt: new Date()
            }
        });
    }

    async getHistory(id: string) {
        // Encontrar a regra raiz
        const rule = await this.prisma.pricingRule.findUnique({
            where: { id }
        });

        if (!rule) throw new NotFoundError('Regra de Precificação');

        const rootId = rule.parentId || rule.id;

        return this.prisma.pricingRule.findMany({
            where: {
                OR: [
                    { id: rootId },
                    { parentId: rootId }
                ]
            },
            orderBy: {
                version: 'desc'
            }
        });
    }

    async delete(id: string) {
        await this.prisma.pricingRule.delete({
            where: { id }
        });
        return { message: 'Regra removida com sucesso' };
    }
}

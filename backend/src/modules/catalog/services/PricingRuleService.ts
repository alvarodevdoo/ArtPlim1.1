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
                formula: typeof data.formula === 'string' ? data.formula : JSON.stringify(data.formula),
                config: data.config ? (typeof data.config === 'string' ? data.config : JSON.stringify(data.config)) : null,
                active: data.active ?? true
            }
        });
    }

    async list() {
        return this.prisma.pricingRule.findMany({
            where: {
                active: true
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
        const updateData: any = { ...data };
        
        if (updateData.formula) {
            updateData.formula = typeof updateData.formula === 'string' 
                ? updateData.formula 
                : JSON.stringify(updateData.formula);
        }

        if (updateData.config) {
            updateData.config = typeof updateData.config === 'string'
                ? updateData.config
                : JSON.stringify(updateData.config);
        }

        // Destructuring para remover organizationId do update do Prisma
        const { organizationId: _orgId, ...finalUpdateData } = updateData;

        return this.prisma.pricingRule.update({
            where: { id },
            data: {
                ...finalUpdateData,
                updatedAt: new Date()
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

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
                config: data.config,
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
        return this.prisma.pricingRule.update({
            where: { id },
            data: {
                ...data,
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

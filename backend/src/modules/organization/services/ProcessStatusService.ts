import prisma from '../../../shared/infrastructure/database/prisma';
import { ProcessStatus, StatusScope, OrderStatus, Prisma } from '@prisma/client';

export interface CreateProcessStatusInput {
    organizationId: string;
    name: string;
    color?: string;
    icon?: string;
    parentId?: string;
    scope?: StatusScope;
    mappedBehavior: OrderStatus;
    allowEdition?: boolean;
    requirePayment?: boolean;
    requireDeposit?: boolean;
    displayOrder?: number;
    hideFromFlow?: boolean;
}

export interface UpdateProcessStatusInput {
    name?: string;
    color?: string;
    icon?: string;
    parentId?: string;
    scope?: StatusScope;
    mappedBehavior?: OrderStatus;
    allowEdition?: boolean;
    requirePayment?: boolean;
    requireDeposit?: boolean;
    displayOrder?: number;
    active?: boolean;
    hideFromFlow?: boolean;
}

export class ProcessStatusService {
    async create(data: CreateProcessStatusInput) {
        // Se tiver pai, valida se existe e pertence à mesma organização
        if (data.parentId) {
            const parent = await prisma.processStatus.findFirst({
                where: { id: data.parentId, organizationId: data.organizationId },
            });
            if (!parent) {
                throw new Error('Status pai não encontrado ou inválido.');
            }
        }

        return prisma.processStatus.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                color: data.color,
                icon: data.icon,
                parentId: data.parentId,
                scope: data.scope || 'ORDER',
                mappedBehavior: data.mappedBehavior,
                allowEdition: data.allowEdition ?? true,
                requirePayment: data.requirePayment ?? false,
                requireDeposit: data.requireDeposit ?? false,
                displayOrder: data.displayOrder || 1,
                hideFromFlow: data.hideFromFlow || false,
            },
            include: { children: true, parent: true }
        });
    }

    async update(id: string, organizationId: string, data: UpdateProcessStatusInput) {
        const status = await prisma.processStatus.findFirst({
            where: { id, organizationId },
        });

        if (!status) {
            throw new Error('Status não encontrado.');
        }

        // Extrai apenas os campos editáveis, ignorando campos de sistema
        // que o frontend pode enviar de volta (id, children, parent, createdAt, etc.)
        const { name, color, icon, parentId, scope, mappedBehavior, allowEdition, requirePayment, requireDeposit, displayOrder, active, hideFromFlow } = data as any;

        const cleanData: UpdateProcessStatusInput = {};
        if (name !== undefined)          cleanData.name = name;
        if (color !== undefined)         cleanData.color = color;
        if (icon !== undefined)          cleanData.icon = icon;
        if (parentId !== undefined)      cleanData.parentId = parentId || undefined;
        if (scope !== undefined)         cleanData.scope = scope;
        if (mappedBehavior !== undefined) cleanData.mappedBehavior = mappedBehavior;
        if (allowEdition !== undefined)  cleanData.allowEdition = allowEdition;
        if (requirePayment !== undefined) cleanData.requirePayment = requirePayment;
        if (requireDeposit !== undefined) cleanData.requireDeposit = requireDeposit;
        if (displayOrder !== undefined)  cleanData.displayOrder = displayOrder;
        if (active !== undefined)        cleanData.active = active;
        if (hideFromFlow !== undefined)  cleanData.hideFromFlow = hideFromFlow;

        return prisma.processStatus.update({
            where: { id },
            data: cleanData,
            include: { children: true, parent: true }
        });
    }

    async delete(id: string, organizationId: string) {
        const status = await prisma.processStatus.findFirst({
            where: { id, organizationId },
            include: { children: true, orders: { take: 1 }, orderItems: { take: 1 } },
        });

        if (!status) {
            throw new Error('Status não encontrado.');
        }

        if (status.children.length > 0) {
            throw new Error('Não é possível remover um status que possui sub-status. Remova ou mova os filhos primeiro.');
        }

        if (status.orders.length > 0 || status.orderItems.length > 0) {
            // Soft delete se estiver em uso
            return prisma.processStatus.update({
                where: { id },
                data: { active: false },
            });
        }

        return prisma.processStatus.delete({
            where: { id },
        });
    }

    async list(organizationId: string) {
        return prisma.processStatus.findMany({
            where: { organizationId, active: true },
            orderBy: { displayOrder: 'asc' },
            include: { children: { where: { active: true }, orderBy: { displayOrder: 'asc' } } }
        });
    }

    async getTree(organizationId: string) {
        // Retorna apenas os raízes (sem parentId), com seus filhos carregados
        return prisma.processStatus.findMany({
            where: { organizationId, active: true, parentId: null },
            orderBy: { displayOrder: 'asc' },
            include: {
                children: {
                    where: { active: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    // Migração / Inicialização
    async ensureDefaultStatuses(organizationId: string) {
        const count = await prisma.processStatus.count({
            where: { organizationId },
        });

        if (count > 0) return; // Já existem status

        const defaults = [
            { name: 'Rascunho', mappedBehavior: OrderStatus.DRAFT, color: '#9CA3AF', icon: 'FileText', allowEdition: true, requirePayment: false, requireDeposit: false, scope: StatusScope.ORDER, order: 1 },
            { name: 'Aprovado', mappedBehavior: OrderStatus.APPROVED, color: '#10B981', icon: 'CheckCircle', allowEdition: false, requirePayment: false, requireDeposit: true, scope: StatusScope.ORDER, order: 2 },
            { name: 'Em Produção', mappedBehavior: OrderStatus.IN_PRODUCTION, color: '#3B82F6', icon: 'Settings', allowEdition: false, requirePayment: false, requireDeposit: false, scope: StatusScope.BOTH, order: 3 },
            { name: 'Finalizado', mappedBehavior: OrderStatus.FINISHED, color: '#4F46E5', icon: 'Package', allowEdition: false, requirePayment: true, requireDeposit: false, scope: StatusScope.BOTH, order: 4 },
            { name: 'Entregue', mappedBehavior: OrderStatus.DELIVERED, color: '#059669', icon: 'Truck', allowEdition: false, requirePayment: true, requireDeposit: false, scope: StatusScope.BOTH, order: 5, hideFromFlow: true },
            { name: 'Cancelado', mappedBehavior: OrderStatus.CANCELLED, color: '#EF4444', icon: 'XCircle', allowEdition: false, requirePayment: false, requireDeposit: false, scope: StatusScope.ORDER, order: 6, hideFromFlow: true },
        ];

        for (const def of defaults) {
            await prisma.processStatus.create({
                data: {
                    organizationId,
                    name: def.name,
                    mappedBehavior: def.mappedBehavior,
                    color: def.color,
                    icon: def.icon,
                    allowEdition: def.allowEdition,
                    scope: def.scope,
                    displayOrder: def.order,
                    hideFromFlow: (def as any).hideFromFlow || false,
                },
            });
        }
    }
}

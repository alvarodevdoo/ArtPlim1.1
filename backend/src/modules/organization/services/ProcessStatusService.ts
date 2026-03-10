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
    displayOrder?: number;
}

export interface UpdateProcessStatusInput {
    name?: string;
    color?: string;
    icon?: string;
    parentId?: string;
    scope?: StatusScope;
    mappedBehavior?: OrderStatus;
    allowEdition?: boolean;
    displayOrder?: number;
    active?: boolean;
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
                displayOrder: data.displayOrder || 1,
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

        return prisma.processStatus.update({
            where: { id },
            data,
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
            { name: 'Rascunho', mappedBehavior: OrderStatus.DRAFT, color: '#9CA3AF', icon: 'FileText', allowEdition: true, scope: StatusScope.ORDER, order: 1 },
            { name: 'Aprovado', mappedBehavior: OrderStatus.APPROVED, color: '#10B981', icon: 'CheckCircle', allowEdition: false, scope: StatusScope.ORDER, order: 2 },
            { name: 'Em Produção', mappedBehavior: OrderStatus.IN_PRODUCTION, color: '#3B82F6', icon: 'Settings', allowEdition: false, scope: StatusScope.BOTH, order: 3 },
            { name: 'Finalizado', mappedBehavior: OrderStatus.FINISHED, color: '#4F46E5', icon: 'Package', allowEdition: false, scope: StatusScope.BOTH, order: 4 },
            { name: 'Entregue', mappedBehavior: OrderStatus.DELIVERED, color: '#059669', icon: 'Truck', allowEdition: false, scope: StatusScope.BOTH, order: 5 },
            { name: 'Cancelado', mappedBehavior: OrderStatus.CANCELLED, color: '#EF4444', icon: 'XCircle', allowEdition: false, scope: StatusScope.ORDER, order: 6 },
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
                },
            });
        }
    }
}

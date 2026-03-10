
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillItemStatuses() {
    console.log('Iniciando sincronização de status de itens...');

    const items = await prisma.orderItem.findMany({
        include: {
            processStatus: true,
            order: true
        }
    });

    console.log(`Processando ${items.length} itens...`);

    let count = 0;
    for (const item of items) {
        let newStatus = item.status;

        if (item.processStatus) {
            newStatus = item.processStatus.mappedBehavior;
        } else {
            // Se não tem status de produção, herda do pai por segurança no backfill
            newStatus = item.order.status;
        }

        if (newStatus !== item.status) {
            await prisma.orderItem.update({
                where: { id: item.id },
                data: { status: newStatus }
            });
            count++;
        }
    }

    console.log(`Backfill concluído! ${count} itens atualizados.`);

    // Recalcular status dos pais
    const orders = await prisma.order.findMany({
        select: { id: true }
    });

    console.log('Recalculando status dos pedidos...');
    for (const order of orders) {
        const orderItems = await prisma.orderItem.findMany({
            where: { orderId: order.id },
            select: { status: true }
        });

        if (orderItems.length > 0) {
            // Lógica simplificada de agregação
            const activeStatuses = orderItems.filter(i => i.status !== 'CANCELLED').map(i => i.status);
            if (activeStatuses.length > 0) {
                const weights = { 'DRAFT': 0, 'APPROVED': 1, 'IN_PRODUCTION': 2, 'FINISHED': 3, 'DELIVERED': 4 };
                const minWeight = Math.min(...activeStatuses.map(s => weights[s] ?? 0));
                const newParentStatus = Object.keys(weights).find(key => weights[key] === minWeight) || 'DRAFT';

                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: newParentStatus }
                });
            }
        }
    }

    console.log('Sincronização de pedidos concluída!');
}

backfillItemStatuses()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

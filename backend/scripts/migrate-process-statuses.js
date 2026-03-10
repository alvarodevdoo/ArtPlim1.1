
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    try {
        console.log('🚀 Iniciando script de migração de status...');

        // Buscar todas as organizações
        const organizations = await prisma.organization.findMany();

        for (const org of organizations) {
            console.log(`\n📦 Processando organização: ${org.name} (${org.id})`);

            // 1. Garantir que existem os status default (ou os que o usuário criou)
            // Vou carregar os status existentes da org
            const statuses = await prisma.processStatus.findMany({
                where: { organizationId: org.id }
            });

            if (statuses.length === 0) {
                console.log(`⚠️  Org ${org.name} não tem status definidos. Pulando...`);
                continue;
            }

            // Criar mapa de comportamento -> statusId
            const statusMap = {};
            statuses.forEach(s => {
                if (s.mappedBehavior) {
                    statusMap[s.mappedBehavior] = s.id;
                }
            });

            console.log('🗺️  Mapa de status:', statusMap);

            // 2. Migrar Pedidos sem statusId
            const orders = await prisma.order.findMany({
                where: { organizationId: org.id, processStatusId: null },
            });

            console.log(`📝 Encontrados ${orders.length} pedidos para migrar.`);
            for (const order of orders) {
                const targetStatusId = statusMap[order.status];
                if (targetStatusId) {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: { processStatusId: targetStatusId }
                    });
                }
            }

            // 3. Migrar Itens de Pedido sem statusId
            const items = await prisma.orderItem.findMany({
                where: {
                    order: { organizationId: org.id },
                    processStatusId: null
                },
                include: { order: { select: { status: true } } }
            });

            console.log(`📋 Encontrados ${items.length} itens para migrar.`);
            for (const item of items) {
                const targetStatusId = statusMap[item.order.status];
                if (targetStatusId) {
                    await prisma.orderItem.update({
                        where: { id: item.id },
                        data: { processStatusId: targetStatusId }
                    });
                }
            }

            console.log(`✅ Concluído para ${org.name}`);
        }

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();

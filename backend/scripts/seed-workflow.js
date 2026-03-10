
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error('Nenhuma organização encontrada.');
        return;
    }

    const statuses = [
        { name: 'Aberto', color: '#3b82f6', mappedBehavior: 'DRAFT', scope: 'ORDER', displayOrder: 1 },
        { name: 'Montagem da Arte', color: '#8b5cf6', mappedBehavior: 'IN_PRODUCTION', scope: 'BOTH', displayOrder: 2 },
        { name: 'Aguardando Aprovação', color: '#f59e0b', mappedBehavior: 'APPROVED', scope: 'ORDER', displayOrder: 3 },
        { name: 'Corte a Laser', color: '#ef4444', mappedBehavior: 'IN_PRODUCTION', scope: 'ITEM', displayOrder: 4 },
        { name: 'Produção Terceirizada', color: '#6366f1', mappedBehavior: 'IN_PRODUCTION', scope: 'ITEM', displayOrder: 5 },
        { name: 'Disponível para Retirada', color: '#10b981', mappedBehavior: 'FINISHED', scope: 'ORDER', displayOrder: 6 },
        { name: 'Material Entregue', color: '#6b7280', mappedBehavior: 'DELIVERED', scope: 'ORDER', displayOrder: 7 },
    ];

    console.log(`Populando status para a organização: ${org.name} (${org.id})`);

    for (const s of statuses) {
        const existing = await prisma.processStatus.findFirst({
            where: {
                organizationId: org.id,
                name: s.name,
            }
        });

        if (existing) {
            await prisma.processStatus.update({
                where: { id: existing.id },
                data: {
                    ...s,
                    active: true
                }
            });
            console.log(`Status atualizado: ${s.name}`);
        } else {
            await prisma.processStatus.create({
                data: {
                    ...s,
                    organizationId: org.id,
                    active: true
                }
            });
            console.log(`Status criado: ${s.name}`);
        }
    }

    console.log('Seed finalizado com sucesso!');
}

seed()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

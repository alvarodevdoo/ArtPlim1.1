import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const orgs = await prisma.organization.findMany();
    for (const org of orgs) {
      const cancelStatus = await prisma.processStatus.findFirst({
        where: { organizationId: org.id, mappedBehavior: 'CANCELLED' }
      });
      if (cancelStatus) {
        await prisma.order.updateMany({
          where: { organizationId: org.id, status: 'CANCELLED' },
          data: { processStatusId: cancelStatus.id }
        });
        await prisma.orderItem.updateMany({
           where: { order: { organizationId: org.id }, status: 'CANCELLED' },
           data: { processStatusId: cancelStatus.id }
        });
        console.log(`Atualizados pedidos cancelados da org ${org.name} para o statusId correto`);
      }
    }
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

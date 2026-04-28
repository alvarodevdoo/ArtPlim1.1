import { PrismaClient } from '@prisma/client';
import { StatusEngine } from './src/modules/sales/domain/services/StatusEngine';

const prisma = new PrismaClient();

async function run() {
  try {
    const engine = new StatusEngine(prisma as any);
    const order = await prisma.order.findUnique({
      where: { id: '2377e2ff-0200-4738-81a9-99896e1b4206' },
      select: { organizationId: true, total: true, status: true }
    });

    if (!order) {
        console.log("Pedido não encontrado");
        return;
    }

    // Try a simulated update to trigger validation
    await engine.updateOrderStatus({
      orderId: '2377e2ff-0200-4738-81a9-99896e1b4206',
      organizationId: order.organizationId,
      newStatus: 'DELIVERED', // or whatever status is blocking
      userId: 'test'
    });

    console.log("Status atualizado sem erro.");
  } catch (error) {
    console.error("ERRO DETECTADO:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profileName = 'Portuguesa';
  const profile = await prisma.profile.findFirst({
    where: { name: { contains: profileName, mode: 'insensitive' } }
  });

  if (!profile) {
    console.log('Cliente não encontrado');
    return;
  }

  // Buscar pedidos cancelados desse cliente hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      customerId: profile.id,
      status: 'CANCELLED',
      updatedAt: { gte: today }
    }
  });

  console.log('--- Diagnóstico ---');
  console.log(`Cliente: ${profile.name} (ID: ${profile.id})`);
  console.log(`Saldo Atual no DB: ${profile.balance}`);
  console.log(`Pedidos Cancelados Hoje: ${orders.length}`);

  orders.forEach(o => {
    console.log(`- Pedido #${o.orderNumber}: Total R$ ${o.total}, Ação: ${o.cancellationPaymentAction}, Reembolso: ${o.cancellationRefundAmount}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

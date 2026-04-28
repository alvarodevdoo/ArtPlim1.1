const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customerName = 'Banca da Portuguesa';
  const profile = await prisma.profile.findFirst({
    where: { name: { contains: customerName, mode: 'insensitive' } },
    include: {
      balanceMovements: true
    }
  });

  if (!profile) {
    console.log('CLIENTE NÃO ENCONTRADO');
    return;
  }

  console.log(`CLIENTE: ${profile.name} (ID: ${profile.id})`);
  console.log(`SALDO NO BANCO: ${profile.balance}`);
  console.log(`QUANTIDADE MOVIMENTAÇÕES: ${profile.balanceMovements.length}`);

  const cancelledOrders = await prisma.order.findMany({
    where: {
      customerId: profile.id,
      status: 'CANCELLED'
    },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  console.log('\n--- ÚLTIMOS PEDIDOS CANCELADOS ---');
  cancelledOrders.forEach(o => {
    console.log(`PEDIDO: #${o.orderNumber} | STATUS: ${o.status}`);
    console.log(`  Motivo: ${o.cancellationReason}`);
    console.log(`  Ação: ${o.cancellationPaymentAction}`);
    console.log(`  Reembolso: ${o.cancellationRefundAmount}`);
    console.log('---------------------------');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'PED-0015' }
  });
  console.log('Order:', JSON.stringify(order, null, 2));

  if (order) {
    const receivable = await prisma.accountReceivable.findFirst({
      where: { orderId: order.id }
    });
    console.log('Receivable:', JSON.stringify(receivable, null, 2));

    const transactions = await prisma.transaction.findMany({
      where: { orderId: order.id }
    });
    console.log('Transactions Count:', transactions.length);
  }

  await prisma.$disconnect();
}
run();

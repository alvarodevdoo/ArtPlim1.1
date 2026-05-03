import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'PED-0019' }
  });
  if (!order) return;
  
  const transactions = await prisma.transaction.findMany({
    where: { orderId: order.id }
  });
  console.log('Transactions for Order PED-0019:', JSON.stringify(transactions, null, 2));

  await prisma.$disconnect();
}
run();

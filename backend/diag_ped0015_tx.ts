import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const transactions = await prisma.transaction.findMany({
    where: { orderId: '9706a04a-19f3-41c7-9760-34bbdfc10c81' }
  });
  console.log('Transactions:', JSON.stringify(transactions, null, 2));
  await prisma.$disconnect();
}
run();

import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const transactions = await prisma.transaction.findMany({
    where: { receivableId: 'cd97ffde-1641-410c-ac56-ac6cdd1ff20c' }
  });
  console.log('Transactions for Receivable cd97...:', JSON.stringify(transactions, null, 2));

  await prisma.$disconnect();
}
run();

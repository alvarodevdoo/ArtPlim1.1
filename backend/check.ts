import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const accountReceivables = await prisma.accountReceivable.findMany({
    where: { order: { orderNumber: 'PED-0019' } },
    include: { 
      order: true, 
      transactions: {
        include: { paymentMethod: true, account: true }
      } 
    }
  });
  console.log('Account Receivables for PED-0019:', JSON.stringify(accountReceivables, null, 2));

  await prisma.$disconnect();
}
run();

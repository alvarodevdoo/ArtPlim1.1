import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const allTxs = await prisma.transaction.findMany();
  const matched = allTxs.filter(t => t.receivableId === 'cd97ffde-1641-410c-ac56-ac6cdd1ff20c');
  console.log('Matched Txs:', matched.length);
  
  // Also check if any tx has type DEBIT and was created around the same time
  const recentDebits = await prisma.transaction.findMany({
    where: { 
      type: 'DEBIT',
      createdAt: { gte: new Date('2026-04-29T11:00:00Z'), lte: new Date('2026-04-29T11:20:00Z') }
    }
  });
  console.log('Recent Debits:', JSON.stringify(recentDebits, null, 2));

  await prisma.$disconnect();
}
run();

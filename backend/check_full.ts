import { prisma } from './src/shared/infrastructure/database/prisma';

async function run() {
  const orgId = 'e4e1ae07-489f-4a43-972b-55f544204e77';
  
  // 1. Verificar se existe conta do tipo RECEIVABLE
  const receivableAccounts = await prisma.account.findMany({
    where: { organizationId: orgId, type: 'RECEIVABLE' }
  });
  console.log('=== CONTAS RECEIVABLE ===');
  console.log(JSON.stringify(receivableAccounts, null, 2));

  // 2. Verificar todas as transações recentes (últimas 24h)
  const recentTxs = await prisma.transaction.findMany({
    where: { 
      organizationId: orgId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n=== TRANSAÇÕES RECENTES (24h) ===');
  console.log(JSON.stringify(recentTxs, null, 2));

  // 3. Verificar o receivable do PED-0019
  const receivable = await prisma.accountReceivable.findFirst({
    where: { order: { orderNumber: 'PED-0019' } }
  });
  console.log('\n=== RECEIVABLE PED-0019 ===');
  console.log(JSON.stringify(receivable, null, 2));

  // 4. Contar TODAS as transações com receivableId
  const allWithReceivable = await prisma.transaction.findMany({
    where: { receivableId: { not: null } }
  });
  console.log('\n=== TRANSAÇÕES COM receivableId ===');
  console.log('Total:', allWithReceivable.length);
  if (allWithReceivable.length > 0) {
    console.log(JSON.stringify(allWithReceivable.slice(0, 3), null, 2));
  }

  await prisma.$disconnect();
}
run();

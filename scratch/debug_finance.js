
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFinance() {
  const organizationId = (await prisma.organization.findFirst()).id;
  
  console.log('--- ORDERS ---');
  const orders = await prisma.order.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      accountsReceivable: true
    }
  });
  console.log(JSON.stringify(orders, null, 2));

  console.log('--- ACCOUNTS RECEIVABLE ---');
  const receivables = await prisma.accountReceivable.findMany({
    where: { organizationId },
    include: {
        order: { select: { orderNumber: true } },
        transactions: true
    }
  });
  console.log(JSON.stringify(receivables, null, 2));

  console.log('--- TRANSACTIONS (INCOME) ---');
  const txs = await prisma.transaction.findMany({
      where: { organizationId, type: 'INCOME' },
      take: 10,
      orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(txs, null, 2));
}

debugFinance().catch(console.error).finally(() => prisma.$disconnect());

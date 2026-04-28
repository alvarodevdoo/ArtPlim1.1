
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFinancialStatus() {
  const org = await prisma.organization.findFirst();
  if (!org) return console.log('No organization found');
  
  const organizationId = org.id;
  console.log(`Checking org: ${organizationId}`);

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId }
  });
  console.log('--- SETTINGS ---');
  console.log(JSON.stringify(settings, null, 2));

  const orders = await prisma.order.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      accountsReceivable: {
          include: { transactions: true }
      }
    }
  });
  console.log('--- ORDERS & RECEIVABLES ---');
  console.log(JSON.stringify(orders, null, 2));

  const incomeTxs = await prisma.transaction.findMany({
      where: { organizationId, type: 'INCOME' },
      take: 10,
      orderBy: { createdAt: 'desc' }
  });
  console.log('--- RECENT INCOME TRANSACTIONS ---');
  console.log(JSON.stringify(incomeTxs, null, 2));
}

checkFinancialStatus().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.profile.findFirst({
    where: { name: 'Banca da Portuguesa' }
  });

  if (!profile) {
    console.log('Profile not found');
    return;
  }

  console.log('Profile ID:', profile.id);
  console.log('Current Balance:', profile.balance.toString());

  const movements = await prisma.profileBalanceMovement.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { orderNumber: true } }
    }
  });

  console.log('Movements Count:', movements.length);
  movements.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] ${m.type} | Amount: ${m.amount.toString()} | Desc: ${m.description} | Order: ${m.order?.orderNumber || 'N/A'}`);
  });

  const stats = await prisma.profileBalanceMovement.groupBy({
    by: ['type'],
    where: { profileId: profile.id },
    _sum: { amount: true }
  });

  console.log('Stats:', JSON.stringify(stats, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

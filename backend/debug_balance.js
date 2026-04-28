const { PrismaClient } = require('@prisma/client');

async function main() {
  process.env.DATABASE_URL = "postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public";
  const prisma = new PrismaClient();

  try {
    const profile = await prisma.profile.findFirst({
      where: { name: 'Banca da Portuguesa' }
    });

    if (!profile) {
      console.log('Profile not found');
      return;
    }

    console.log('Profile ID:', profile.id);
    console.log('Balance:', profile.balance.toString());

    const movements = await prisma.profileBalanceMovement.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true } }
      }
    });

    console.log('--- MOVEMENTS ---');
    movements.forEach(m => {
      console.log(`${m.createdAt.toISOString()} | ${m.type} | ${m.amount} | ${m.description} | Order: ${m.order?.orderNumber || 'N/A'}`);
    });

    const stats = await prisma.profileBalanceMovement.groupBy({
      by: ['type'],
      where: { profileId: profile.id },
      _sum: { amount: true }
    });

    console.log('--- STATS ---');
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

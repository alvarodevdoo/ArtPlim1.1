const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const res = await prisma.processStatus.findMany({ 
      select: { 
        name: true, 
        mappedBehavior: true, 
        requirePayment: true, 
        requireDeposit: true 
      }
    });
    console.table(res);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

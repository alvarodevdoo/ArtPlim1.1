
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.organization.updateMany({
    data: { maxDiscountThreshold: 0.15 }
  });
  console.log('Updated', result.count, 'organizations');
}

main().catch(console.error).finally(() => prisma.$disconnect());

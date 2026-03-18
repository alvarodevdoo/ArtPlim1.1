const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const rules = await prisma.pricingRule.findMany({
      select: {
          name: true,
          formula: true
      }
    });
    console.log(JSON.stringify(rules, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

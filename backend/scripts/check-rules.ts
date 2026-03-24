import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRules() {
  const rules = await prisma.pricingRule.findMany({
    select: {
      id: true,
      name: true,
      formula: true
    }
  });

  console.log('--- Current Pricing Rules ---');
  rules.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Name: ${r.name}`);
    console.log(`Formula Type: ${typeof r.formula}`);
    console.log(`Formula Content: ${JSON.stringify(r.formula, null, 2)}`);
    console.log('---');
  });
}

checkRules().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { minPrice: { gt: 0 } },
        { salePrice: { gt: 0 } }
      ]
    },
    select: {
      id: true,
      name: true,
      minPrice: true,
      salePrice: true,
      pricingMode: true,
      pricingRuleId: true,
      customFormula: true
    }
  });

  console.log('--- Products with fixed prices ---');
  console.table(products.map(p => ({
    name: p.name,
    mode: p.pricingMode,
    minPrice: p.minPrice?.toString(),
    salePrice: p.salePrice?.toString(),
    hasFormula: !!(p.pricingRuleId || p.customFormula)
  })));

  const pricingRules = await prisma.pricingRule.findMany();
  console.log('\n--- Pricing Rules ---');
  pricingRules.forEach(rule => {
    console.log(`Rule: ${rule.name}`);
    console.log(`Formula: ${JSON.stringify(rule.formula, null, 2)}`);
    console.log('---');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

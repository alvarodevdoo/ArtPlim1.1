
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: 'Adesivo Vinil' },
    include: { pricingRule: true }
  });

  if (!product) {
    console.log('Product not found');
    return;
  }

  console.log('Product:', product.name);
  console.log('Pricing Rule:', product.pricingRule?.name);
  console.log('Formula:', product.pricingRule?.formula);
  
  if (product.pricingRule?.formula) {
      try {
          const formula = JSON.parse(product.pricingRule.formula);
          console.log('Variables:', JSON.stringify(formula.variables, null, 2));
          console.log('Formula String:', formula.formulaString);
      } catch (e) {
          console.log('Could not parse formula JSON');
      }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

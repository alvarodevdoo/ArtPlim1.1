import { prisma } from '../src/shared/infrastructure/database/prisma';

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'Vinil', mode: 'insensitive' } },
    include: { pricingRule: true }
  });

  if (!product) {
    console.log('Produto não encontrado');
    return;
  }

  console.log('=== PRODUTO ===');
  console.log('ID:', product.id);
  console.log('Nome:', product.name);
  console.log('pricingMode:', product.pricingMode);
  console.log('pricingRuleId:', product.pricingRuleId);
  console.log('\n=== formulaData ===');
  console.log(JSON.stringify(product.formulaData, null, 2));

  if (product.pricingRule) {
    console.log('\n=== formula.variables ===');
    const formula = product.pricingRule.formula as any;
    console.log(JSON.stringify(formula?.variables, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

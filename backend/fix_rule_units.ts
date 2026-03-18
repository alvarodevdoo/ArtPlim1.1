
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rule = await prisma.pricingRule.findFirst({
    where: { name: 'Vinil' }
  });

  if (!rule) {
    console.log('Rule not found');
    return;
  }

  const formula = JSON.parse(rule.formula as string);
  
  // Corrigir baseUnit para metros para que a conta (m * m * preco_m2) funcione
  formula.variables = formula.variables.map((v: any) => {
    if (v.id === 'largura' || v.id === 'altura') {
      return {
        ...v,
        baseUnit: 'm',
        allowedUnits: ['cm', 'mm', 'm']
      };
    }
    return v;
  });

  await prisma.pricingRule.update({
    where: { id: rule.id },
    data: { formula: JSON.stringify(formula) }
  });

  console.log('Rule updated: baseUnits for largura/altura set to "m"');
}

main().catch(console.error).finally(() => prisma.$disconnect());

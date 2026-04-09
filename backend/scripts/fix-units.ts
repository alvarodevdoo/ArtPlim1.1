import { prisma } from '../src/shared/infrastructure/database/prisma';

async function main() {
  console.log('🚀 Corrigindo unidades das regras de precificação...');

  // 1. Atualizar a regra padrão no banco
  const rules = await prisma.pricingRule.findMany({
    where: { active: true }
  });

  for (const rule of rules) {
    const formula = rule.formula as any;
    if (formula && formula.variables) {
      let changed = false;
      formula.variables = formula.variables.map((v: any) => {
        if (v.id === 'VALOR_BASE' && (v.defaultUnit === 'moeda' || !v.defaultUnit)) {
          console.log(`✅ Atualizando VALOR_BASE para m2 na regra: ${rule.name}`);
          v.defaultUnit = 'm2';
          changed = true;
        }
        return v;
      });

      if (changed) {
        await prisma.pricingRule.update({
          where: { id: rule.id },
          data: { formula }
        });
      }
    }
  }

  console.log('✨ Concluído!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

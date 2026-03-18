
import { PrismaClient } from '@prisma/client';
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

  // 1. Corrigir a fórmula da regra "Vinil" (já fizemos no outro script, mas garantindo aqui)
  if (product.pricingRule) {
      const formula = JSON.parse(product.pricingRule.formula as string);
      formula.formulaString = "(LARGURA * ALTURA) * price";
      
      // Garantir unidades em metros para o cálculo direto
      formula.variables = formula.variables.map((v: any) => {
          if (v.role === 'WIDTH' || v.role === 'HEIGHT') {
              return { ...v, baseUnit: 'm' };
          }
          return v;
      });

      await prisma.pricingRule.update({
          where: { id: product.pricingRule.id },
          data: { formula: JSON.stringify(formula) }
      });
      console.log('Rule "Vinil" updated to use (LARGURA * ALTURA) * price and baseUnit: m');
  }

  // 2. Limpar o preço de venda e a fórmula customizada do produto
  // Colocar salePrice como null ou 0 garante que o motor use o resultado da fórmula (Vinil m2 * preço)
  await prisma.product.update({
    where: { id: product.id },
    data: { 
      customFormula: null,
      salePrice: 0 // Zera o preço fixo para não ignorar o cálculo da fórmula
    }
  });
  console.log('Product customFormula cleared and salePrice set to 0 (forcing formula use)');
}

main().catch(console.error).finally(() => prisma.$disconnect());

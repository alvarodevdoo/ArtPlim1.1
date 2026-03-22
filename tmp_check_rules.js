const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkRule() {
  const totalItems = await prisma.orderItem.count();
  const itemsWithRule = await prisma.orderItem.count({
    where: { NOT: { pricingRuleId: null } }
  });
  
  const rules = await prisma.pricingRule.findMany({
    include: {
      _count: {
        select: { orderItems: true }
      }
    }
  });

  let output = `TOTAL OrderItems: ${totalItems}\n`;
  output += `OrderItems with pricingRuleId: ${itemsWithRule}\n\n`;
  output += '--- REGRAS DE PRECIFICAÇÃO NO BANCO ---\n';
  rules.forEach(r => {
    output += `ID: ${r.id} | Nome: ${r.name} | Versão: ${r.version} | Itens: ${r._count.orderItems}\n`;
  });
  
  fs.writeFileSync('d:/www/NArtPlim/rules_output.txt', output);
  console.log('Output saved to rules_output.txt');
}

checkRule()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

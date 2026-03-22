const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkItems() {
  const items = await prisma.orderItem.findMany({
    take: 5,
    orderBy: { id: 'desc' }
  });

  let output = '--- ORDER ITEMS RECENTES ---\n';
  items.forEach(i => {
    output += `ID: ${i.id} | ProductID: ${i.productId} | RuleID: ${i.pricingRuleId} | Price: ${i.unitPrice}\n`;
  });
  
  fs.writeFileSync('d:/www/NArtPlim/items_debug.txt', output);
  console.log('Output saved to items_debug.txt');
}

checkItems()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

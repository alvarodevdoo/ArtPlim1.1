const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkOneItem() {
  const item = await prisma.orderItem.findFirst({
    where: { NOT: { pricingRuleId: null } }
  });

  if (item) {
    fs.writeFileSync('d:/www/NArtPlim/one_item_debug.json', JSON.stringify(item, null, 2));
    console.log('Encontrado item COM regra. Salvo em one_item_debug.json');
  } else {
    const anyItem = await prisma.orderItem.findFirst();
    if (anyItem) {
      fs.writeFileSync('d:/www/NArtPlim/one_item_debug.json', JSON.stringify(anyItem, null, 2));
      console.log('Nenhum item com regra encontrado. Salva estrutura de um item qualquer.');
    } else {
      console.log('Nenhum item encontrado no banco.');
    }
  }
}

checkOneItem()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

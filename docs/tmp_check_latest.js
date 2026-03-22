const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkLatestItem() {
  const items = await prisma.orderItem.findMany({
    orderBy: { order: { createdAt: 'desc' } },
    take: 10
  });

  if (items.length > 0) {
    fs.writeFileSync('d:/www/NArtPlim/latest_items_debug.json', JSON.stringify(items, null, 2));
    console.log('Saved to latest_items_debug.json');
  } else {
    console.log('Nenhum item encontrado no banco.');
  }
}

checkLatestItem()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
